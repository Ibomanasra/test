import "server-only";
import { businessDate, cashDifference, invoiceOpenAmount, sumDenominations } from "@sa/core";
import type { cashClosingSubmitSchema, deliverStopSchema, tourCreateSchema } from "@sa/contracts";
import { allocateDocumentNumber, prisma, type Prisma, type Tx } from "@sa/db";
import type { z } from "zod";
import { storeFile } from "../adapters/storage";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, forbidden, notFound } from "../errors";
import { recordPayment } from "./finance";
import { failDelivery, markDelivered } from "./orders";

/**
 * Touren, Fahreransicht und Kassenabschluss (Phase 5).
 * Nachnahme-Soll je Stopp = offener Betrag der Rechnung des Lieferscheins (nur Barzahlung bei Lieferung).
 */

/** Datumsspalten (@db.Date) speichern den Kalendertag: UTC-Mitternacht des Geschäftstags */
const dbDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const todayDb = () => dbDate(businessDate(new Date()));

const canPlan = (ctx: AuthContext) => ctx.permissions.has("*") || ctx.permissions.has("delivery.plan");

async function codFor(tx: Tx | typeof prisma, shipmentId: string): Promise<number> {
  const s = await tx.shipment.findUnique({ where: { id: shipmentId }, select: { order: { select: { paymentMethod: true } }, invoice: { select: { totalGross: true, paidAmount: true, creditedAmount: true } } } });
  if (!s || s.order.paymentMethod !== "CASH_ON_DELIVERY" || !s.invoice) return 0;
  return invoiceOpenAmount(s.invoice);
}

/** Lieferscheine „Unterwegs“ ohne Tour (für die Tourenplanung) */
export function unassignedShipments(zoneId?: string | null) {
  return prisma.shipment.findMany({
    where: { status: "LOADED", tourStop: null, ...(zoneId ? { order: { zoneId } } : {}) },
    orderBy: { createdAt: "asc" },
    include: { order: { select: { id: true, number: true, paymentMethod: true, addressSnapshot: true, zone: { select: { nameAr: true, nameEn: true } }, customer: { select: { displayName: true } } } }, invoice: { select: { totalGross: true, paidAmount: true, creditedAmount: true } } },
  });
}

export function listDrivers() {
  return prisma.user.findMany({ where: { kind: "STAFF", isActive: true, roles: { some: { role: { OR: [{ key: "driver" }, { permissions: { has: "delivery.driver" } }] } } } }, select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } });
}

export async function listTours(f: { date?: string; driverId?: string }) {
  const where: Prisma.TourWhereInput = {
    ...(f.date ? { date: dbDate(f.date) } : {}),
    ...(f.driverId ? { driverId: f.driverId } : {}),
  };
  return prisma.tour.findMany({ where, orderBy: [{ date: "desc" }, { number: "desc" }], take: 100, include: { driver: { select: { name: true } }, zone: { select: { nameAr: true, nameEn: true } }, stops: { select: { status: true, codExpected: true } } } });
}

export async function getTour(id: string) {
  const t = await prisma.tour.findUnique({
    where: { id },
    include: {
      driver: { select: { id: true, name: true, phone: true } },
      zone: true,
      stops: { orderBy: { sequence: "asc" }, include: { collections: { select: { amount: true } }, shipment: { include: { order: { select: { id: true, number: true, paymentMethod: true, addressSnapshot: true, customer: { select: { displayName: true, phone: true } } } }, invoice: { select: { id: true, number: true, totalGross: true } } } } } },
    },
  });
  if (!t) throw notFound();
  return t;
}

export async function createTour(ctx: AuthContext, input: z.infer<typeof tourCreateSchema>) {
  return prisma.$transaction(async (tx) => {
    const { number } = await allocateDocumentNumber(tx, "TOUR_SHEET");
    const tour = await tx.tour.create({ data: { number, date: dbDate(businessDate(input.date)), driverId: input.driverId, zoneId: input.zoneId ?? null, note: input.note } });
    await addStops(tx, tour.id, input.shipmentIds);
    await audit(ctx, { action: "tour.create", entityType: "Tour", entityId: tour.id, after: { number, stops: input.shipmentIds.length } }, tx);
    return tour;
  });
}

async function addStops(tx: Tx, tourId: string, shipmentIds: string[]) {
  const last = await tx.tourStop.findFirst({ where: { tourId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
  let seq = last?.sequence ?? 0;
  for (const id of shipmentIds) {
    const s = await tx.shipment.findUnique({ where: { id }, select: { status: true, tourStop: { select: { id: true } } } });
    if (!s || s.status !== "LOADED") throw badRequest("shipment_not_loaded");
    if (s.tourStop) throw new AppError(409, "shipment_in_tour");
    await tx.tourStop.create({ data: { tourId, shipmentId: id, sequence: ++seq, codExpected: await codFor(tx, id) } });
  }
}

export async function addTourStops(ctx: AuthContext, tourId: string, shipmentIds: string[]) {
  await prisma.$transaction(async (tx) => {
    const t = await tx.tour.findUnique({ where: { id: tourId } });
    if (!t) throw notFound();
    if (t.status === "COMPLETED" || t.status === "CLOSED") throw new AppError(409, "invalid_status");
    await addStops(tx, tourId, shipmentIds);
    await audit(ctx, { action: "tour.add_stops", entityType: "Tour", entityId: tourId, after: { shipmentIds } }, tx);
  });
}

export async function removeTourStop(ctx: AuthContext, stopId: string) {
  const s = await prisma.tourStop.findUnique({ where: { id: stopId } });
  if (!s) throw notFound();
  if (s.status !== "PENDING") throw new AppError(409, "invalid_status");
  await prisma.tourStop.delete({ where: { id: stopId } });
  await audit(ctx, { action: "tour.remove_stop", entityType: "Tour", entityId: s.tourId, before: s });
}

/** Reihenfolge der Stopps ändern (Liste der Stopp-IDs in neuer Reihenfolge) */
export async function reorderStops(ctx: AuthContext, tourId: string, stopIds: string[]) {
  await prisma.$transaction(async (tx) => {
    const stops = await tx.tourStop.findMany({ where: { tourId } });
    if (stops.length !== stopIds.length || !stopIds.every((id) => stops.some((s) => s.id === id))) throw badRequest("invalid_order");
    // zweistufig wegen @@unique([tourId, sequence])
    for (const [i, id] of stopIds.entries()) await tx.tourStop.update({ where: { id }, data: { sequence: 10_000 + i } });
    for (const [i, id] of stopIds.entries()) await tx.tourStop.update({ where: { id }, data: { sequence: i + 1 } });
    await audit(ctx, { action: "tour.reorder", entityType: "Tour", entityId: tourId, after: { stopIds } }, tx);
  });
}

export async function setTourStatus(ctx: AuthContext, tourId: string, status: "LOADED" | "ON_ROUTE" | "COMPLETED") {
  const t = await prisma.tour.findUnique({ where: { id: tourId } });
  if (!t) throw notFound();
  if (!canPlan(ctx) && t.driverId !== ctx.user.id) throw forbidden();
  await prisma.tour.update({ where: { id: tourId }, data: { status } });
  await audit(ctx, { action: "tour.status", entityType: "Tour", entityId: tourId, before: { status: t.status }, after: { status } });
}

// ---------------------------------------------------------------------------
// Fahrer
// ---------------------------------------------------------------------------

export async function driverTours(driverId: string) {
  const today = todayDb();
  return prisma.tour.findMany({
    where: { driverId, OR: [{ date: { gte: today } }, { status: { in: ["PLANNED", "LOADED", "ON_ROUTE"] } }] },
    orderBy: [{ date: "asc" }, { number: "asc" }],
    include: {
      stops: { orderBy: { sequence: "asc" }, include: { shipment: { include: { order: { select: { number: true, paymentMethod: true, addressSnapshot: true, customer: { select: { displayName: true, phone: true } } } }, invoice: { select: { number: true } } } } } },
    },
  });
}

async function stopForDriver(ctx: AuthContext, stopId: string) {
  const stop = await prisma.tourStop.findUnique({ where: { id: stopId }, include: { tour: true, shipment: { include: { order: true, invoice: true } } } });
  if (!stop) throw notFound();
  if (stop.tour.driverId !== ctx.user.id && !canPlan(ctx)) throw forbidden();
  if (stop.status !== "PENDING") throw new AppError(409, "invalid_status");
  return stop;
}

async function maybeCompleteTour(tourId: string) {
  const open = await prisma.tourStop.count({ where: { tourId, status: "PENDING" } });
  if (open === 0) await prisma.tour.update({ where: { id: tourId }, data: { status: "COMPLETED" } });
  else await prisma.tour.updateMany({ where: { id: tourId, status: { in: ["PLANNED", "LOADED"] } }, data: { status: "ON_ROUTE" } });
}

/** Zustellung bestätigen: Unterschrift, Empfänger, Bargeld (→ Quittung + Kassenbuchung des Fahrers) */
export async function deliverStop(ctx: AuthContext, stopId: string, input: z.infer<typeof deliverStopSchema>) {
  const stop = await stopForDriver(ctx, stopId);
  let signatureFileId: string | null = null;
  if (input.signature) {
    const data = Buffer.from(input.signature.split(",")[1] ?? "", "base64");
    if (data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw badRequest("invalid_file_type");
    signatureFileId = (await storeFile({ data, mimeType: "image/png", originalName: `${stop.shipment.number}-signature.png`, purpose: "signature", uploadedById: ctx.user.id })).id;
  }
  // Lieferung abschließen (Bestellstatus, Benachrichtigung, Auto-Druck) – bestehender Ablauf
  if (stop.shipment.order.status === "OUT_FOR_DELIVERY") await markDelivered(ctx, stop.shipment.orderId, input.receivedByName);
  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({ where: { id: stop.shipmentId }, data: { status: "DELIVERED", deliveredAt: new Date(), receivedByName: input.receivedByName ?? null, ...(signatureFileId ? { signatureFileId } : {}) } });
    if (input.cashAmount > 0) {
      const p = await recordPayment(ctx, { customerId: stop.shipment.order.customerId, method: "CASH_ON_DELIVERY", amount: input.cashAmount, receivedAt: null, note: undefined, reference: stop.shipment.number, invoiceIds: stop.shipment.invoice && invoiceOpenAmount(stop.shipment.invoice) > 0 ? [stop.shipment.invoice.id] : undefined }, tx);
      await tx.cashCollection.create({ data: { driverId: stop.tour.driverId ?? ctx.user.id, tourStopId: stop.id, amount: input.cashAmount, paymentId: p.id } });
    }
    await tx.tourStop.update({ where: { id: stop.id }, data: { status: "DELIVERED", completedAt: new Date() } });
    await audit(ctx, { action: "delivery.confirm", entityType: "TourStop", entityId: stop.id, after: { shipment: stop.shipment.number, cash: input.cashAmount, signature: !!signatureFileId } }, tx);
  });
  await maybeCompleteTour(stop.tourId);
}

export async function failStop(ctx: AuthContext, stopId: string, reason: string) {
  const stop = await stopForDriver(ctx, stopId);
  await failDelivery(ctx, stop.shipment.orderId, reason);
  await prisma.tourStop.update({ where: { id: stop.id }, data: { status: "FAILED", failReason: reason, completedAt: new Date() } });
  await maybeCompleteTour(stop.tourId);
}

// ---------------------------------------------------------------------------
// Kassenabschluss
// ---------------------------------------------------------------------------

/** Offene (noch nicht abgerechnete) Bareinnahmen eines Fahrers */
export async function driverCash(driverId: string) {
  const collections = await prisma.cashCollection.findMany({
    where: { driverId, closingId: null },
    orderBy: { collectedAt: "asc" },
    include: { payment: { select: { number: true, customer: { select: { displayName: true } } } }, tourStop: { select: { shipment: { select: { number: true } } } } },
  });
  return { collections, expected: collections.reduce((a, c) => a + c.amount, 0) };
}

/** Fahrer zählt das Bargeld (Stückelung) → Abschluss „eingereicht“ */
export async function submitCashClosing(ctx: AuthContext, input: z.infer<typeof cashClosingSubmitSchema>, driverId = ctx.user.id) {
  const counted = sumDenominations(input.denominations);
  return prisma.$transaction(async (tx) => {
    const date = todayDb();
    const open = await tx.cashCollection.findMany({ where: { driverId, closingId: null } });
    const existing = await tx.cashClosing.findUnique({ where: { driverId_date: { driverId, date } } });
    if (existing?.status === "APPROVED") throw new AppError(409, "closing_approved");
    const already = existing ? await tx.cashCollection.aggregate({ where: { closingId: existing.id }, _sum: { amount: true } }) : null;
    const expected = open.reduce((a, c) => a + c.amount, 0) + (already?._sum.amount ?? 0);
    const data = { expected, counted, difference: cashDifference(expected, counted), status: "SUBMITTED" as const, denominations: input.denominations, note: input.note ?? null };
    const closing = existing
      ? await tx.cashClosing.update({ where: { id: existing.id }, data })
      : await tx.cashClosing.create({ data: { ...data, number: (await allocateDocumentNumber(tx, "CASH_CLOSING")).number, driverId, date } });
    await tx.cashCollection.updateMany({ where: { id: { in: open.map((c) => c.id) } }, data: { closingId: closing.id } });
    await audit(ctx, { action: "cash_closing.submit", entityType: "CashClosing", entityId: closing.id, after: { expected, counted, difference: data.difference } }, tx);
    return closing;
  });
}

export async function approveCashClosing(ctx: AuthContext, id: string, note?: string) {
  const c = await prisma.cashClosing.findUnique({ where: { id } });
  if (!c) throw notFound();
  if (c.status !== "SUBMITTED") throw new AppError(409, "invalid_status");
  await prisma.cashClosing.update({ where: { id }, data: { status: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date(), note: note ?? c.note } });
  await audit(ctx, { action: "cash_closing.approve", entityType: "CashClosing", entityId: id, after: { difference: c.difference } });
}

export function listCashClosings() {
  return prisma.cashClosing.findMany({ orderBy: [{ date: "desc" }], take: 100, include: { driver: { select: { name: true } }, _count: { select: { collections: true } } } });
}

/** Bargeld bei Fahrern (für Dashboard/Übersicht) */
export async function cashByDriver() {
  const rows = await prisma.cashCollection.groupBy({ by: ["driverId"], where: { OR: [{ closingId: null }, { closing: { status: { not: "APPROVED" } } }] }, _sum: { amount: true } });
  const users = new Map((await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.driverId) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return rows.map((r) => ({ driverId: r.driverId, name: users.get(r.driverId) ?? "", amount: r._sum.amount ?? 0 }));
}
