import "server-only";
import type { deliveryCompanySchema } from "@sa/contracts";
import { prisma } from "@sa/db";
import type { z } from "zod";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, notFound } from "../errors";
import { invoiceOpenAmount } from "@sa/core";
import { recordPayment } from "./finance";
import { dispatchOrder, type DispatchInput } from "./orders";

/** Externe Zustellfirmen (Kuriere) */
export function listDeliveryCompanies(activeOnly = false) {
  return prisma.deliveryCompany.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { shipments: { where: { status: "LOADED" } } } } },
  });
}

export async function saveDeliveryCompany(ctx: AuthContext, id: string | null, input: z.infer<typeof deliveryCompanySchema>) {
  const clash = await prisma.deliveryCompany.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) } });
  if (clash) throw new AppError(409, "name_taken");
  const data = { name: input.name, phone: input.phone ?? null, note: input.note ?? null, active: input.active };
  const c = id ? await prisma.deliveryCompany.update({ where: { id }, data }).catch(() => { throw notFound(); }) : await prisma.deliveryCompany.create({ data });
  await audit(ctx, { action: id ? "delivery_company.update" : "delivery_company.create", entityType: "DeliveryCompany", entityId: c.id, after: data });
  return c;
}

/** Firma holen oder (per Name) anlegen – für „+ neue Firma“ direkt beim Übergeben */
async function resolveCompany(ctx: AuthContext, companyId?: string, newName?: string) {
  if (newName) {
    const existing = await prisma.deliveryCompany.findFirst({ where: { name: { equals: newName, mode: "insensitive" } } });
    if (existing) return existing.active ? existing : prisma.deliveryCompany.update({ where: { id: existing.id }, data: { active: true } });
    return saveDeliveryCompany(ctx, null, { name: newName, phone: undefined, note: undefined, active: true });
  }
  if (companyId) {
    const c = await prisma.deliveryCompany.findUnique({ where: { id: companyId } });
    if (!c?.active) throw badRequest("invalid_delivery_company");
    return c;
  }
  // ohne Firma: z. B. eigener Fahrer oder Abholung (die Oberfläche verlangt sonst eine Firma)
  return null;
}

/**
 * Schritt 3: An die Zustellfirma übergeben.
 * Erzeugt Lieferschein + Rechnung (wie „Laden“), merkt Firma, Sendungsnummer und Übergabezeit.
 */
export async function handOverOrder(ctx: AuthContext, orderId: string, input: DispatchInput & { companyId?: string; newCompanyName?: string; trackingNumber?: string }) {
  const company = await resolveCompany(ctx, input.companyId, input.newCompanyName);
  const r = await dispatchOrder(ctx, orderId, input);
  if (company || input.trackingNumber) {
    // Nachnahme: die Zustellfirma kassiert den offenen Rechnungsbetrag beim Kunden
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { paymentMethod: true } });
    const inv = await prisma.invoice.findUnique({ where: { id: r.invoice.id }, select: { totalGross: true, paidAmount: true, creditedAmount: true } });
    const cod = company && order?.paymentMethod === "CASH_ON_DELIVERY" && inv ? invoiceOpenAmount(inv) : 0;
    await prisma.shipment.update({ where: { id: r.shipment.id }, data: { deliveryCompanyId: company?.id ?? null, trackingNumber: input.trackingNumber ?? null, handedOverAt: new Date(), codAmount: cod > 0 ? cod : null } });
    await audit(ctx, { action: "order.hand_over", entityType: "Order", entityId: orderId, after: { shipment: r.shipment.number, company: company?.name, trackingNumber: input.trackingNumber } });
  }
  return { ...r, company: company ? { id: company.id, name: company.name } : null };
}


// ---------------------------------------------------------------------------
// Abrechnung: Die Zustellfirma kassiert beim Kunden und gibt das Geld an uns weiter
// ---------------------------------------------------------------------------

const owedWhere = (companyId?: string) => ({
  ...(companyId ? { deliveryCompanyId: companyId } : { deliveryCompanyId: { not: null } }),
  status: "DELIVERED" as const,
  codAmount: { gt: 0 },
  courierSettlementId: null,
});

/** Je Firma: was sie gerade unterwegs kassieren soll und was sie schon kassiert hat (schuldet uns) */
export async function courierAccounts() {
  const companies = await prisma.deliveryCompany.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  const [owed, onTheWay, settlements] = await Promise.all([
    prisma.shipment.findMany({
      where: owedWhere(),
      orderBy: { deliveredAt: "asc" },
      select: { id: true, number: true, codAmount: true, deliveredAt: true, trackingNumber: true, deliveryCompanyId: true, order: { select: { id: true, number: true, customer: { select: { displayName: true } } } } },
    }),
    prisma.shipment.groupBy({ by: ["deliveryCompanyId"], where: { deliveryCompanyId: { not: null }, status: "LOADED", codAmount: { gt: 0 } }, _sum: { codAmount: true }, _count: { _all: true } }),
    prisma.courierSettlement.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { shipments: true } } } }),
  ]);
  return companies
    .map((c) => {
      const list = owed.filter((s) => s.deliveryCompanyId === c.id);
      const way = onTheWay.find((g) => g.deliveryCompanyId === c.id);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        active: c.active,
        owed: list.reduce((a, s) => a + (s.codAmount ?? 0), 0),
        owedItems: list,
        onTheWay: way?._sum.codAmount ?? 0,
        onTheWayCount: way?._count._all ?? 0,
        settlements: settlements.filter((x) => x.companyId === c.id),
      };
    })
    .filter((c) => c.active || c.owed > 0 || c.onTheWay > 0 || c.settlements.length > 0);
}

/** Summe, die alle Zustellfirmen uns gerade schulden (für die Finanz-Übersicht) */
export async function courierOwedTotal() {
  const r = await prisma.shipment.aggregate({ where: owedWhere(), _sum: { codAmount: true } });
  return r._sum.codAmount ?? 0;
}

/**
 * Geld von der Zustellfirma erhalten: bucht für jede gewählte Lieferung eine Zahlung auf die Rechnung
 * (Kunde = bezahlt) und schließt die Lieferungen in einer Abrechnung ab.
 */
export async function settleCourier(ctx: AuthContext, companyId: string, shipmentIds: string[] | undefined, note?: string) {
  const company = await prisma.deliveryCompany.findUnique({ where: { id: companyId } });
  if (!company) throw notFound();
  return prisma.$transaction(
    async (tx) => {
      const shipments = await tx.shipment.findMany({
        where: { ...owedWhere(companyId), ...(shipmentIds?.length ? { id: { in: shipmentIds } } : {}) },
        include: { order: { select: { customerId: true } }, invoice: { select: { id: true, totalGross: true, paidAmount: true, creditedAmount: true } } },
      });
      if (!shipments.length) throw badRequest("nothing_to_settle");
      const total = shipments.reduce((a, s) => a + (s.codAmount ?? 0), 0);
      const settlement = await tx.courierSettlement.create({ data: { companyId, amount: total, note: note ?? null, createdById: ctx.user.id } });
      for (const s of shipments) {
        const open = s.invoice ? invoiceOpenAmount(s.invoice) : 0;
        const amount = Math.min(s.codAmount ?? 0, open);
        if (amount > 0 && s.invoice) {
          await recordPayment(ctx, { customerId: s.order.customerId, method: "CASH_ON_DELIVERY", amount, invoiceIds: [s.invoice.id], receivedAt: null, reference: company.name, note: `${s.number}` }, tx);
        }
        await tx.shipment.update({ where: { id: s.id }, data: { courierSettlementId: settlement.id } });
      }
      await audit(ctx, { action: "courier.settle", entityType: "CourierSettlement", entityId: settlement.id, after: { company: company.name, amount: total, shipments: shipments.length } }, tx);
      return { id: settlement.id, amount: total, count: shipments.length };
    },
    { timeout: 30_000 },
  );
}
