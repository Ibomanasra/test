import "server-only";
import { prisma } from "@sa/db";

const nm = (locale: string, o: { nameAr: string; nameEn: string }) => (locale === "ar" ? o.nameAr : o.nameEn);

export async function priceOptions(locale: string) {
  const [groups, priceLists, categories, customers, variants] = await Promise.all([
    prisma.customerGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.priceList.findMany({ orderBy: { code: "asc" } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.customer.findMany({ where: { type: "B2B" }, select: { id: true, displayName: true, number: true }, orderBy: { displayName: "asc" } }),
    prisma.productVariant.findMany({
      select: { id: true, sku: true, nameAr: true, nameEn: true, product: { select: { nameAr: true, nameEn: true } } },
      orderBy: { sku: "asc" },
    }),
  ]);
  const variantLabel = (v: (typeof variants)[number]) => [nm(locale, v.product), v.nameAr && v.nameEn ? nm(locale, { nameAr: v.nameAr, nameEn: v.nameEn }) : null].filter(Boolean).join(" – ");
  return {
    groups: groups.map((g) => ({ value: g.id, label: nm(locale, g) })),
    groupName: new Map(groups.map((g) => [g.id, nm(locale, g)])),
    priceLists: priceLists.map((p) => ({ value: p.id, label: `${p.code} – ${nm(locale, p)}` })),
    priceListName: new Map(priceLists.map((p) => [p.id, `${p.code} – ${nm(locale, p)}`])),
    categories: categories.map((c) => ({ value: c.id, label: nm(locale, c) })),
    categoryName: new Map(categories.map((c) => [c.id, nm(locale, c)])),
    customers: customers.map((c) => ({ value: c.id, label: `${c.displayName} (${c.number})` })),
    customerName: new Map(customers.map((c) => [c.id, c.displayName])),
    skuOptions: variants.map((v) => ({ sku: v.sku, label: variantLabel(v) })),
    variantSku: new Map(variants.map((v) => [v.id, v.sku])),
    variantLabel: new Map(variants.map((v) => [v.id, `${v.sku} · ${variantLabel(v)}`])),
  };
}
