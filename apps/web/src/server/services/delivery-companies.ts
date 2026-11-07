import "server-only";
import type { deliveryCompanySchema } from "@sa/contracts";
import { prisma } from "@sa/db";
import type { z } from "zod";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, notFound } from "../errors";
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
    await prisma.shipment.update({ where: { id: r.shipment.id }, data: { deliveryCompanyId: company?.id ?? null, trackingNumber: input.trackingNumber ?? null, handedOverAt: new Date() } });
    await audit(ctx, { action: "order.hand_over", entityType: "Order", entityId: orderId, after: { shipment: r.shipment.number, company: company?.name, trackingNumber: input.trackingNumber } });
  }
  return { ...r, company: company ? { id: company.id, name: company.name } : null };
}
