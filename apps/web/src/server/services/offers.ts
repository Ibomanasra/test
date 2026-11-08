import "server-only";
import { normalizeCouponCode, nextThreshold, resolveOffers, type OfferContext, type OfferRule } from "@sa/core";
import type { orderOfferInputSchema } from "@sa/contracts";
import { prisma, type OrderOffer, type Prisma, type Tx } from "@sa/db";
import type { z } from "zod";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, conflict, notFound } from "../errors";

type Channel = "B2C" | "B2B";

/** Kandidaten: aktiv und zeitlich nicht abgelaufen (Feinprüfung in @sa/core) */
async function candidateOffers(db: Tx | typeof prisma = prisma): Promise<OrderOffer[]> {
  const now = new Date();
  return db.orderOffer.findMany({ where: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { createdAt: "asc" } });
}

/**
 * Angebote für einen Warenkorb bewerten. `customerId` null = Gast (nur Anzeige).
 */
export async function evaluateOrderOffers(input: { customerId: string | null; channel: Channel; goodsValue: number; couponCode?: string | null; allowWelcome?: boolean }, db: Tx | typeof prisma = prisma) {
  const rules = await candidateOffers(db);
  let firstOrder = false;
  let usesByCustomer = new Map<string, number>();
  if (input.customerId) {
    const [orders, uses] = await Promise.all([
      db.order.count({ where: { customerId: input.customerId, status: { not: "CANCELLED" } } }),
      db.orderOfferRedemption.groupBy({ by: ["offerId"], where: { customerId: input.customerId }, _count: { _all: true } }),
    ]);
    // Willkommens-Rabatt nur für registrierte Kunden (Anreiz zum Konto)
    firstOrder = orders === 0 && input.allowWelcome !== false;
    usesByCustomer = new Map(uses.map((u) => [u.offerId, typeof u._count === "object" ? (u._count._all ?? 0) : 0]));
  }
  const ctx: OfferContext = { channel: input.channel, goodsValue: input.goodsValue, now: new Date(), firstOrder, couponCode: input.couponCode, usesByCustomer };
  const res = resolveOffers(rules as (OrderOffer & OfferRule)[], ctx);
  return { ...res, next: nextThreshold(rules as (OrderOffer & OfferRule)[], ctx), firstOrder };
}

/** Einlösung buchen (in der Bestell-Transaktion); prüft das Gesamtlimit atomar */
export async function redeemOffer(tx: Tx, offerId: string, customerId: string, orderId: string, amount: number) {
  const offer = await tx.orderOffer.findUniqueOrThrow({ where: { id: offerId } });
  const updated = await tx.orderOffer.updateMany({
    where: { id: offerId, ...(offer.maxUses != null ? { usedCount: { lt: offer.maxUses } } : {}) },
    data: { usedCount: { increment: 1 } },
  });
  if (updated.count === 0) throw new AppError(409, "offer_used_up", "offer_used_up");
  await tx.orderOfferRedemption.create({ data: { offerId, customerId, orderId, amount } });
}

/** Stornierte Bestellung gibt ihre Angebote wieder frei */
export async function releaseOfferRedemptions(tx: Tx, orderId: string) {
  const rows = await tx.orderOfferRedemption.findMany({ where: { orderId } });
  for (const r of rows) await tx.orderOffer.update({ where: { id: r.offerId }, data: { usedCount: { decrement: 1 } } });
  await tx.orderOfferRedemption.deleteMany({ where: { orderId } });
}

/** Für die Shop-Anzeige (Banner, Angebotsseite) */
export async function shopOffers(channel: Channel) {
  const now = new Date();
  const rows = await prisma.orderOffer.findMany({
    where: {
      active: true,
      showInShop: true,
      channel: { in: [channel, "BOTH"] },
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: [{ kind: "asc" }, { minOrderAgorot: "asc" }],
  });
  return rows
    .filter((o) => o.maxUses == null || o.usedCount < o.maxUses)
    .map((o) => ({ ...o, daysLeft: o.endsAt ? Math.ceil((o.endsAt.getTime() - now.getTime()) / 86_400_000) : null }));
}

export type ShopOffer = Awaited<ReturnType<typeof shopOffers>>[number];

// --- Verwaltung --------------------------------------------------------------

type OfferInput = z.infer<typeof orderOfferInputSchema>;

function data(input: OfferInput): Prisma.OrderOfferUncheckedCreateInput {
  if (input.kind !== "FREE_DELIVERY" && !input.percentBps && !input.amountAgorot) throw badRequest("offer_needs_value");
  if (input.kind === "COUPON" && !input.code) throw badRequest("coupon_needs_code");
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw badRequest("invalid_period");
  return {
    kind: input.kind,
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    textAr: input.textAr ?? null,
    textEn: input.textEn ?? null,
    channel: input.channel,
    active: input.active,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    percentBps: input.kind === "FREE_DELIVERY" ? null : (input.percentBps ?? null),
    amountAgorot: input.kind === "FREE_DELIVERY" || input.percentBps ? null : (input.amountAgorot ?? null),
    minOrderAgorot: input.minOrderAgorot ?? 0,
    code: input.kind === "COUPON" && input.code ? normalizeCouponCode(input.code) : null,
    maxUses: input.maxUses ?? null,
    perCustomerLimit: input.kind === "WELCOME" ? 1 : (input.perCustomerLimit ?? null),
    showInShop: input.showInShop,
  };
}

async function assertCodeFree(code: string | null | undefined, exceptId?: string) {
  if (!code) return;
  const dup = await prisma.orderOffer.findFirst({ where: { code, id: exceptId ? { not: exceptId } : undefined }, select: { id: true } });
  if (dup) throw conflict("coupon_code_taken");
}

export async function listOrderOffers() {
  return prisma.orderOffer.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }], include: { _count: { select: { redemptions: true } } } });
}

export async function createOrderOffer(ctx: AuthContext, input: OfferInput) {
  const d = data(input);
  await assertCodeFree(d.code);
  return prisma.$transaction(async (tx) => {
    const o = await tx.orderOffer.create({ data: d });
    await audit(ctx, { action: "offer.create", entityType: "OrderOffer", entityId: o.id, after: o }, tx);
    return o;
  });
}

export async function updateOrderOffer(ctx: AuthContext, id: string, input: OfferInput) {
  const before = await prisma.orderOffer.findUnique({ where: { id } });
  if (!before) throw notFound();
  const d = data(input);
  await assertCodeFree(d.code, id);
  return prisma.$transaction(async (tx) => {
    const o = await tx.orderOffer.update({ where: { id }, data: d });
    await audit(ctx, { action: "offer.update", entityType: "OrderOffer", entityId: id, before, after: o }, tx);
    return o;
  });
}

/** Mit Einlösungen nur deaktivieren (Bestellungen verweisen darauf) */
export async function deleteOrderOffer(ctx: AuthContext, id: string) {
  const o = await prisma.orderOffer.findUnique({ where: { id }, include: { _count: { select: { redemptions: true, orders: true } } } });
  if (!o) throw notFound();
  await prisma.$transaction(async (tx) => {
    if (o._count.redemptions || o._count.orders) await tx.orderOffer.update({ where: { id }, data: { active: false } });
    else await tx.orderOffer.delete({ where: { id } });
    await audit(ctx, { action: "offer.delete", entityType: "OrderOffer", entityId: id, before: o }, tx);
  });
  return { ok: true };
}
