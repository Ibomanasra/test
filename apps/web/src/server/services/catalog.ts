import "server-only";
import type { PriceResult, PricingChannel } from "@sa/core";
import { prisma, type Prisma } from "@sa/db";
import { priceItems, priceKey, type PricingViewer } from "./pricing";

/**
 * Katalog für Shop und App.
 *
 * PREISSCHUTZ (D12): Diese Datei ist die EINZIGE Stelle, an der Produktdaten für
 * Kunden aufbereitet werden. Datenbankabfragen selektieren nie costPrice oder
 * b2bBasePrice; Preise kommen ausschließlich aus resolvePrice() für den
 * wirksamen Kanal des Betrachters. Für B2C/Gäste enthalten die DTOs nur Brutto-
 * preise, Staffeln werden nur an freigegebene Händler ausgeliefert.
 */

const variantSelect = {
  id: true,
  sku: true,
  barcode: true,
  nameAr: true,
  nameEn: true,
  attributes: true,
  minStock: true,
  sortOrder: true,
  units: { select: { factor: true, unit: { select: { id: true, code: true, nameAr: true, nameEn: true } } } },
  channelRules: { select: { channel: true, defaultUnitId: true, allowedUnitIds: true, minQtyBase: true, qtyStepBase: true } },
  stockLevels: { select: { onHand: true, reserved: true } },
} satisfies Prisma.ProductVariantSelect;

const productSelect = {
  id: true,
  slug: true,
  nameAr: true,
  nameEn: true,
  descriptionAr: true,
  descriptionEn: true,
  isDemo: true,
  category: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
  brand: { select: { name: true } },
  images: { select: { fileId: true, altAr: true, altEn: true }, orderBy: { sortOrder: "asc" } },
  variants: { where: { active: true }, select: variantSelect, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;
type VariantRow = ProductRow["variants"][number];

export type Availability = "in_stock" | "low" | "out";

export interface UnitDto {
  code: string;
  nameAr: string;
  nameEn: string;
  factor: number;
}

export interface VariantDto {
  id: string;
  sku: string;
  barcode: string | null;
  nameAr: string | null;
  nameEn: string | null;
  units: UnitDto[];
  defaultUnit: string;
  minQtyBase: number;
  qtyStepBase: number;
  availability: Availability;
  /** Preis pro Stück: B2C brutto, B2B netto */
  unitPrice: number;
  /** Brutto pro Stück (Anzeige) */
  unitGross: number;
  /** Listenpreis vor Aktion (für Streichpreis) – nur wenn höher */
  listUnitPrice: number | null;
  promotion: boolean;
  /** nur B2B: Staffeln ab Menge (netto pro Stück) */
  tiers?: { minQtyBase: number; unitPrice: number }[];
}

export interface ProductDto {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  category: { slug: string; nameAr: string; nameEn: string };
  brand: string | null;
  imageIds: string[];
  isDemo: boolean;
  channel: PricingChannel;
  variants: VariantDto[];
}

export function availabilityOf(v: { minStock: number; stockLevels: { onHand: number; reserved: number }[] }): Availability {
  const available = v.stockLevels.reduce((a, s) => a + s.onHand - s.reserved, 0);
  if (available <= 0) return "out";
  if (available <= v.minStock) return "low";
  return "in_stock";
}

function unitsFor(v: VariantRow, channel: PricingChannel) {
  const rule = v.channelRules.find((r) => r.channel === channel);
  const all = v.units.map((u) => ({ id: u.unit.id, code: u.unit.code, nameAr: u.unit.nameAr, nameEn: u.unit.nameEn, factor: u.factor }));
  const allowed = rule?.allowedUnitIds.length ? all.filter((u) => rule.allowedUnitIds.includes(u.id)) : all;
  const def = allowed.find((u) => u.id === rule?.defaultUnitId) ?? allowed.find((u) => u.factor === 1) ?? allowed[0];
  return {
    units: allowed.map(({ id: _id, ...u }) => u).sort((a, b) => a.factor - b.factor),
    defaultUnit: def?.code ?? "PIECE",
    minQtyBase: rule?.minQtyBase ?? 1,
    qtyStepBase: rule?.qtyStepBase ?? 1,
  };
}

function toVariantDto(v: VariantRow, channel: PricingChannel, price: PriceResult | undefined, tiers?: { minQtyBase: number; unitPrice: number }[]): VariantDto | null {
  if (!price) return null;
  const u = unitsFor(v, channel);
  const promoted = price.rule === "PROMOTION" && price.unitPrice < price.listUnitPrice;
  return {
    id: v.id,
    sku: v.sku,
    barcode: v.barcode,
    nameAr: v.nameAr,
    nameEn: v.nameEn,
    ...u,
    availability: availabilityOf(v),
    unitPrice: price.unitPrice,
    unitGross: price.unitGross,
    listUnitPrice: price.unitPrice < price.listUnitPrice ? price.listUnitPrice : null,
    promotion: promoted,
    ...(channel === "B2B" && tiers ? { tiers } : {}),
  };
}

function visibilityWhere(channel: PricingChannel): Prisma.ProductWhereInput {
  return { active: true, ...(channel === "B2B" ? { visibleB2B: true } : { visibleB2C: true }), variants: { some: { active: true } } };
}

/** Preise für die Standardmenge (Mindestmenge des Kanals) bzw. 1 Stück */
async function priceProducts(rows: ProductRow[], viewer: PricingViewer, withTiers: boolean) {
  const reqs = rows.flatMap((p) => p.variants.map((v) => ({ variantId: v.id, qtyBase: unitsFor(v, viewer.channel).minQtyBase })));
  const prices = await priceItems(reqs, viewer);
  let tierMap = new Map<string, { minQtyBase: number; unitPrice: number }[]>();
  if (withTiers && viewer.channel === "B2B") {
    const tierRows = await prisma.tierPrice.findMany({
      where: { variantId: { in: reqs.map((r) => r.variantId) } },
      select: { variantId: true, minQtyBase: true },
      orderBy: { minQtyBase: "asc" },
    });
    // Staffelpreise für DIESEN Kunden berechnen (Gruppe, Kategorie-Rabatt usw. inklusive)
    const tierReqs = tierRows.map((t) => ({ variantId: t.variantId, qtyBase: t.minQtyBase }));
    const tierPrices = await priceItems(tierReqs, viewer);
    tierMap = new Map();
    for (const t of tierRows) {
      const p = tierPrices.get(priceKey(t.variantId, t.minQtyBase));
      if (!p) continue;
      const list = tierMap.get(t.variantId) ?? [];
      if (!list.some((x) => x.minQtyBase === t.minQtyBase)) list.push({ minQtyBase: t.minQtyBase, unitPrice: p.unitPrice });
      tierMap.set(t.variantId, list);
    }
  }
  return rows.map((p) => toProductDto(p, viewer.channel, (v) => prices.get(priceKey(v.id, unitsFor(v, viewer.channel).minQtyBase)), tierMap));
}

function toProductDto(
  p: ProductRow,
  channel: PricingChannel,
  priceOf: (v: VariantRow) => PriceResult | undefined,
  tierMap: Map<string, { minQtyBase: number; unitPrice: number }[]>,
): ProductDto {
  return {
    id: p.id,
    slug: p.slug,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    descriptionAr: p.descriptionAr,
    descriptionEn: p.descriptionEn,
    category: { slug: p.category.slug, nameAr: p.category.nameAr, nameEn: p.category.nameEn },
    brand: p.brand?.name ?? null,
    imageIds: p.images.map((i) => i.fileId),
    isDemo: p.isDemo,
    channel,
    variants: p.variants.flatMap((v) => {
      const d = toVariantDto(v, channel, priceOf(v), tierMap.get(v.id));
      return d ? [d] : [];
    }),
  };
}

export const CATALOG_PAGE_SIZE = 24;

export interface CatalogFilter {
  q?: string;
  category?: string;
  promo?: boolean;
  page: number;
}

export async function listCatalog(viewer: PricingViewer, f: CatalogFilter) {
  const q = f.q?.trim();
  const where: Prisma.ProductWhereInput = {
    ...visibilityWhere(viewer.channel),
    ...(f.category ? { category: { OR: [{ slug: f.category }, { parent: { slug: f.category } }] } } : {}),
    ...(q
      ? {
          OR: [
            { nameAr: { contains: q, mode: "insensitive" } },
            { nameEn: { contains: q, mode: "insensitive" } },
            { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" } }, { barcode: q }, { units: { some: { barcode: q } } }] } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({ where, select: productSelect, orderBy: [{ category: { sortOrder: "asc" } }, { nameEn: "asc" }], skip: (f.page - 1) * CATALOG_PAGE_SIZE, take: CATALOG_PAGE_SIZE }),
    prisma.product.count({ where }),
  ]);
  let items = await priceProducts(rows, viewer, false);
  if (f.promo) items = items.filter((p) => p.variants.some((v) => v.promotion));
  return { items, total, pageSize: CATALOG_PAGE_SIZE };
}

export async function getCatalogProduct(viewer: PricingViewer, slug: string): Promise<ProductDto | null> {
  const row = await prisma.product.findFirst({ where: { slug, ...visibilityWhere(viewer.channel) }, select: productSelect });
  if (!row) return null;
  return (await priceProducts([row], viewer, true))[0] ?? null;
}

export async function listCategories() {
  return prisma.category.findMany({
    where: { active: true, parentId: null },
    select: { id: true, slug: true, nameAr: true, nameEn: true, _count: { select: { products: { where: { active: true } } } } },
    orderBy: { sortOrder: "asc" },
  });
}
