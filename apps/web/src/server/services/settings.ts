import "server-only";
import type { DeliveryZoneInput, companySettingsSchema, paymentMethodUpdateSchema, taxRateCreateSchema } from "@sa/contracts";
import { assertNoOverlap, businessDate, startOfBusinessDay } from "@sa/core";
import { prisma } from "@sa/db";
import type { z } from "zod";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, conflict, notFound } from "../errors";

export async function getCompanySettings() {
  const s = await prisma.companySettings.findUnique({ where: { id: 1 } });
  if (!s) throw new AppError(500, "company_settings_missing");
  return s;
}

export async function updateCompanySettings(ctx: AuthContext, input: z.infer<typeof companySettingsSchema>) {
  const before = await getCompanySettings();
  return prisma.$transaction(async (tx) => {
    const after = await tx.companySettings.update({ where: { id: 1 }, data: input });
    await audit(ctx, { action: "settings.company", entityType: "CompanySettings", entityId: "1", before, after }, tx);
    return after;
  });
}

export function listTaxRates() {
  return prisma.taxRate.findMany({ orderBy: [{ code: "asc" }, { validFrom: "desc" }] });
}

/**
 * Neuer Steuersatz ab Datum. Der bisher offene Satz desselben Codes endet
 * automatisch am neuen Startdatum. Ausgestellte Belege behalten ihren Satz (Snapshot).
 */
export async function addTaxRate(ctx: AuthContext, input: z.infer<typeof taxRateCreateSchema>) {
  // Frühestens ab heute 00:00 Ortszeit – rückwirkende Sätze würden historische Daten verfälschen
  if (input.validFrom < startOfBusinessDay(businessDate(new Date()))) throw badRequest("tax_rate_in_past");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.taxRate.findMany({ where: { code: input.code } });
    const open = existing.find((r) => r.validTo === null);
    if (open && open.validFrom >= input.validFrom) throw badRequest("tax_rate_before_current");
    const closed = existing.map((r) => (r.id === open?.id ? { ...r, validTo: input.validFrom } : r));
    assertNoOverlap([...closed, { code: input.code, rateBps: input.rateBps, validFrom: input.validFrom, validTo: null }]);
    if (open) await tx.taxRate.update({ where: { id: open.id }, data: { validTo: input.validFrom } });
    const created = await tx.taxRate.create({ data: input });
    await audit(ctx, { action: "settings.tax_rate", entityType: "TaxRate", entityId: created.id, before: open ?? null, after: created }, tx);
    return created;
  });
}

/** Geplante (noch nicht gültige) Sätze dürfen gelöscht werden; der Vorgänger wird wieder offen. */
export async function deleteFutureTaxRate(ctx: AuthContext, id: string) {
  const rate = await prisma.taxRate.findUnique({ where: { id } });
  if (!rate) throw notFound();
  if (rate.validFrom <= new Date()) throw new AppError(409, "tax_rate_already_active");
  await prisma.$transaction(async (tx) => {
    await tx.taxRate.delete({ where: { id } });
    await tx.taxRate.updateMany({ where: { code: rate.code, validTo: rate.validFrom }, data: { validTo: null } });
    await audit(ctx, { action: "settings.tax_rate_delete", entityType: "TaxRate", entityId: id, before: rate }, tx);
  });
}

export function listZones(onlyActive = false) {
  return prisma.deliveryZone.findMany({
    where: onlyActive ? { active: true } : undefined,
    include: { rates: true },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
  });
}

export async function upsertZone(ctx: AuthContext, id: string | null, input: DeliveryZoneInput) {
  const { rates, ...zone } = input;
  const clash = await prisma.deliveryZone.findUnique({ where: { code: zone.code } });
  if (clash && clash.id !== id) throw conflict("zone_code_exists");
  const before = id ? await prisma.deliveryZone.findUnique({ where: { id }, include: { rates: true } }) : null;
  if (id && !before) throw notFound();
  return prisma.$transaction(async (tx) => {
    const saved = id
      ? await tx.deliveryZone.update({ where: { id }, data: zone })
      : await tx.deliveryZone.create({ data: zone });
    for (const r of rates) {
      await tx.deliveryZoneRate.upsert({
        where: { zoneId_channel: { zoneId: saved.id, channel: r.channel } },
        create: { ...r, zoneId: saved.id },
        update: r,
      });
    }
    const after = await tx.deliveryZone.findUnique({ where: { id: saved.id }, include: { rates: true } });
    await audit(ctx, { action: id ? "settings.zone_update" : "settings.zone_create", entityType: "DeliveryZone", entityId: saved.id, before, after }, tx);
    return after;
  });
}

export function listPaymentMethods() {
  return prisma.paymentMethodConfig.findMany({ orderBy: [{ channel: "asc" }, { sortOrder: "asc" }] });
}

export async function updatePaymentMethod(ctx: AuthContext, id: string, input: z.infer<typeof paymentMethodUpdateSchema>) {
  const before = await prisma.paymentMethodConfig.findUnique({ where: { id } });
  if (!before) throw notFound();
  // Kauf auf Rechnung gibt es nur für Händler
  if (before.method === "ON_ACCOUNT" && before.channel === "B2C" && input.enabled) throw badRequest("on_account_b2b_only");
  return prisma.$transaction(async (tx) => {
    const after = await tx.paymentMethodConfig.update({ where: { id }, data: input });
    await audit(ctx, { action: "settings.payment_method", entityType: "PaymentMethodConfig", entityId: id, before, after }, tx);
    return after;
  });
}

export function listCustomerGroups() {
  return prisma.customerGroup.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}
