import "server-only";
import { businessDate } from "@sa/core";
import { prisma } from "@sa/db";

export async function quoteEditorOptions(locale: string) {
  const [customers, variants, units, settings] = await Promise.all([
    prisma.customer.findMany({ where: { type: "B2B", status: { in: ["ACTIVE", "PENDING_APPROVAL"] } }, select: { id: true, displayName: true, number: true }, orderBy: { displayName: "asc" } }),
    prisma.productVariant.findMany({
      where: { active: true },
      select: { sku: true, nameAr: true, nameEn: true, product: { select: { nameAr: true, nameEn: true } }, units: { select: { factor: true, unit: { select: { code: true } } } } },
      orderBy: { sku: "asc" },
    }),
    prisma.unitOfMeasure.findMany(),
    prisma.companySettings.findUnique({ where: { id: 1 } }),
  ]);
  const nm = (o: { nameAr: string | null; nameEn: string | null }) => (locale === "ar" ? o.nameAr : o.nameEn);
  return {
    customers: customers.map((c) => ({ value: c.id, label: `${c.displayName} (${c.number})` })),
    skuOptions: variants.map((v) => ({
      sku: v.sku,
      label: [nm(v.product), nm(v)].filter(Boolean).join(" – "),
      units: v.units.map((u) => ({ code: u.unit.code, factor: u.factor })).sort((a, b) => a.factor - b.factor),
    })),
    unitNames: Object.fromEntries(units.map((u) => [u.code, locale === "ar" ? u.nameAr : u.nameEn])),
    defaultValidUntil: businessDate(new Date(Date.now() + (settings?.quoteValidityDays ?? 14) * 86_400_000)),
  };
}
