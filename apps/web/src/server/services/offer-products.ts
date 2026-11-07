import "server-only";
import { prisma } from "@sa/db";
import { priceItems, priceKey } from "./pricing";

export interface OfferProductRow {
  promotionId: string;
  promotionName: string;
  type: "PERCENT" | "FIXED_PRICE" | "BUY_X_GET_Y";
  status: "active" | "planned";
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  imageId: string | null;
  /** über Kategorie statt direkt am Produkt */
  viaCategory: string | null;
  /** Endkunde: Normalpreis → tatsächlicher Preis (brutto); null = Aktion gilt nicht für Endkunden */
  b2c: { normal: number; offer: number; free: string | null } | null;
  /** Händler: Normalpreis → tatsächlicher Preis (netto) */
  b2b: { normal: number; offer: number; free: string | null } | null;
  endsAt: Date;
  startsAt: Date;
}

/**
 * Alle Produkte mit laufendem oder geplantem Produkt-Angebot – mit dem Preis, den der Kunde
 * wirklich zahlt (gleiche Preis-Engine wie im Shop, inkl. Rundung).
 */
export async function offerProductRows(locale: string): Promise<OfferProductRow[]> {
  const now = new Date();
  const promos = await prisma.promotion.findMany({
    where: { active: true, endsAt: { gt: now } },
    include: { targets: { include: { category: { select: { id: true, nameAr: true, nameEn: true } } } } },
    orderBy: { startsAt: "asc" },
  });
  if (!promos.length) return [];
  const categories = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const descendants = (id: string): string[] => [id, ...categories.filter((c) => c.parentId === id).flatMap((c) => descendants(c.id))];

  // Zielvarianten je Aktion
  const pairs: { promo: (typeof promos)[number]; variantIds: string[]; viaCategory: string | null }[] = [];
  for (const p of promos) {
    for (const t of p.targets) {
      if (t.variantId) pairs.push({ promo: p, variantIds: [t.variantId], viaCategory: null });
      else if (t.productId) {
        const vs = await prisma.productVariant.findMany({ where: { productId: t.productId, active: true }, select: { id: true } });
        pairs.push({ promo: p, variantIds: vs.map((v) => v.id), viaCategory: null });
      } else if (t.categoryId) {
        const vs = await prisma.productVariant.findMany({ where: { active: true, product: { archivedAt: null, categoryId: { in: descendants(t.categoryId) } } }, select: { id: true } });
        pairs.push({ promo: p, variantIds: vs.map((v) => v.id), viaCategory: t.category ? (locale === "ar" ? t.category.nameAr : t.category.nameEn) : "" });
      }
    }
  }
  const allIds = [...new Set(pairs.flatMap((x) => x.variantIds))];
  if (!allIds.length) return [];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: allIds } },
    select: { id: true, sku: true, b2cPrice: true, b2bBasePrice: true, productId: true, nameAr: true, nameEn: true, product: { select: { nameAr: true, nameEn: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { fileId: true } } } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const rows: OfferProductRow[] = [];
  for (const { promo, variantIds, viaCategory } of pairs) {
    // Preis zum Zeitpunkt, an dem die Aktion gilt (geplante: kurz nach Beginn)
    const at = promo.startsAt > now ? new Date(promo.startsAt.getTime() + 60_000) : now;
    // Für „Kaufe X, bekomme Y“ die Menge X+Y bewerten, sonst 1 Stück
    const qty = promo.type === "BUY_X_GET_Y" && promo.buyQty && promo.getQty ? promo.buyQty + promo.getQty : 1;
    const items = variantIds.map((variantId) => ({ variantId, qtyBase: qty }));
    const [b2c, b2b] = await Promise.all([
      promo.channel !== "B2B" ? priceItems(items, { channel: "B2C", customerId: null }, at) : null,
      promo.channel !== "B2C" && !promo.groupId ? priceItems(items, { channel: "B2B", customerId: null }, at) : null,
    ]);
    for (const id of variantIds) {
      const v = byId.get(id);
      if (!v) continue;
      const pick = (m: Map<string, { unitPrice: number; listUnitPrice: number; freeQtyBase: number }> | null, normal: number) => {
        const r = m?.get(priceKey(id, qty));
        if (!r) return null;
        return { normal, offer: r.unitPrice, free: r.freeQtyBase ? `${qty - r.freeQtyBase} + ${r.freeQtyBase}` : null };
      };
      const nameV = locale === "ar" ? v.nameAr : v.nameEn;
      rows.push({
        promotionId: promo.id,
        promotionName: locale === "ar" ? promo.nameAr : promo.nameEn || promo.nameAr,
        type: promo.type,
        status: promo.startsAt > now ? "planned" : "active",
        variantId: id,
        productId: v.productId,
        sku: v.sku,
        name: [locale === "ar" ? v.product.nameAr : v.product.nameEn || v.product.nameAr, nameV].filter(Boolean).join(" – "),
        imageId: v.product.images[0]?.fileId ?? null,
        viaCategory,
        b2c: pick(b2c, v.b2cPrice),
        b2b: pick(b2b, v.b2bBasePrice),
        endsAt: promo.endsAt,
        startsAt: promo.startsAt,
      });
    }
  }
  return rows.sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "active" ? -1 : 1));
}
