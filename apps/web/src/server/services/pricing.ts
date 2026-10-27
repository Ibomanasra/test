import "server-only";
import {
  resolvePrice,
  resolveTaxRate,
  type PriceResult,
  type PricingChannel,
  type PricingCustomer,
  type PricingProduct,
  type PromotionRule,
} from "@sa/core";
import { prisma } from "@sa/db";

/**
 * Lädt alle Preisregeln für eine Menge von Varianten in wenigen Abfragen
 * und baut daraus die Eingaben für resolvePrice() (packages/core).
 */

export interface PricingViewer {
  channel: PricingChannel;
  customerId: string | null;
  /** Preisliste je Gruppe (ohne kundenindividuelle Preise) */
  groupId?: string | null;
}

export async function loadPricingCustomer(customerId: string | null): Promise<PricingCustomer | null> {
  if (!customerId) return null;
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, groupId: true, group: { select: { id: true, pricingMode: true, discountBps: true, priceListId: true, active: true } } },
  });
  if (!c) return null;
  return { id: c.id, groupId: c.groupId, group: c.group?.active ? c.group : null };
}

/** Gruppen-„Kunde“ für Gruppen-Preislisten: keine Kunden-ID → keine Sonderpreise/Angebote */
export async function loadPricingGroup(groupId: string): Promise<PricingCustomer | null> {
  const g = await prisma.customerGroup.findUnique({ where: { id: groupId }, select: { id: true, pricingMode: true, discountBps: true, priceListId: true, active: true } });
  if (!g) return null;
  return { id: `group:${g.id}`, groupId: g.id, group: g.active ? g : null };
}

/** Kategorie-ID → [eigene ID, Eltern-ID, …] */
async function categoryAncestors(): Promise<Map<string, string[]>> {
  const cats = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const parent = new Map(cats.map((c) => [c.id, c.parentId]));
  const out = new Map<string, string[]>();
  for (const c of cats) {
    const chain: string[] = [];
    let cur: string | null | undefined = c.id;
    while (cur && !chain.includes(cur)) {
      chain.push(cur);
      cur = parent.get(cur);
    }
    out.set(c.id, chain);
  }
  return out;
}

export async function currentTaxRateBps(date: Date, code = "STANDARD"): Promise<number> {
  const rates = await prisma.taxRate.findMany({ where: { code } });
  return resolveTaxRate(rates, date, code).rateBps;
}

export async function getMinMarginBps(): Promise<number> {
  return (await prisma.companySettings.findUnique({ where: { id: 1 }, select: { minMarginBps: true } }))?.minMarginBps ?? 0;
}

export async function loadPricingProducts(
  variantIds: string[],
  customer: PricingCustomer | null,
  date: Date,
  channel: PricingChannel,
  quoteId?: string | null,
): Promise<Map<string, PricingProduct>> {
  const ids = [...new Set(variantIds)];
  if (ids.length === 0) return new Map();
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      costPrice: true,
      b2cPrice: true,
      b2bBasePrice: true,
      productId: true,
      product: { select: { categoryId: true, taxCode: true } },
    },
  });
  const ancestors = await categoryAncestors();
  const productIds = [...new Set(variants.map((v) => v.productId))];
  const allCategoryIds = [...new Set(variants.flatMap((v) => ancestors.get(v.product.categoryId) ?? []))];
  const taxRates = await prisma.taxRate.findMany();
  const b2b = channel === "B2B";

  const [customerPrices, priceListItems, tierPrices, categoryDiscounts, promotions, roundingRules, quoteItems] = await Promise.all([
    b2b && customer ? prisma.customerPrice.findMany({ where: { customerId: customer.id, variantId: { in: ids } } }) : [],
    b2b && customer?.group?.priceListId
      ? prisma.priceListItem.findMany({ where: { priceListId: customer.group.priceListId, variantId: { in: ids }, priceList: { active: true } } })
      : [],
    b2b ? prisma.tierPrice.findMany({ where: { variantId: { in: ids } } }) : [],
    b2b && customer
      ? prisma.categoryDiscount.findMany({
          where: {
            categoryId: { in: allCategoryIds },
            OR: [{ customerId: customer.id }, ...(customer.groupId ? [{ groupId: customer.groupId }] : [])],
          },
        })
      : [],
    prisma.promotion.findMany({
      where: {
        active: true,
        startsAt: { lte: date },
        endsAt: { gt: date },
        channel: { in: [channel, "BOTH"] },
        targets: { some: { OR: [{ variantId: { in: ids } }, { productId: { in: productIds } }, { categoryId: { in: allCategoryIds } }] } },
      },
      include: { targets: true },
    }),
    !b2b ? prisma.roundingRule.findMany({ where: { channel: "B2C", active: true } }) : [],
    b2b && customer && quoteId
      ? prisma.quoteItem.findMany({
          where: { quoteId, variantId: { in: ids }, quote: { customerId: customer.id, status: "ACCEPTED", validUntil: { gt: date } } },
          include: { quote: { select: { isFixed: true } } },
        })
      : [],
  ]);

  const result = new Map<string, PricingProduct>();
  for (const v of variants) {
    const cats = ancestors.get(v.product.categoryId) ?? [v.product.categoryId];
    const promos: PromotionRule[] = [];
    for (const p of promotions) {
      // spezifischstes Ziel: Variante > Produkt > Kategorie
      const target =
        p.targets.find((t) => t.variantId === v.id) ??
        p.targets.find((t) => t.productId === v.productId) ??
        p.targets.find((t) => t.categoryId && cats.includes(t.categoryId));
      if (!target) continue;
      promos.push({
        id: p.id,
        channel: p.channel,
        type: p.type,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        active: p.active,
        priority: p.priority,
        percentBps: p.percentBps,
        buyQty: p.buyQty,
        getQty: p.getQty,
        groupId: p.groupId,
        fixedPrice: target.fixedPrice,
      });
    }
    const quoteItem = quoteItems.find((q) => q.variantId === v.id);
    result.set(v.id, {
      variantId: v.id,
      categoryIds: cats,
      costPrice: v.costPrice,
      b2cPrice: v.b2cPrice,
      b2bBasePrice: v.b2bBasePrice,
      taxRateBps: resolveTaxRate(taxRates, date, v.product.taxCode).rateBps,
      rules: {
        quote: quoteItem && quoteId ? { quoteId, unitPriceNet: quoteItem.unitPriceNet, isFixed: quoteItem.quote.isFixed } : null,
        customerPrices: customerPrices.filter((c) => c.variantId === v.id),
        priceListItems: priceListItems.filter((i) => i.variantId === v.id),
        tierPrices: tierPrices.filter((t) => t.variantId === v.id),
        categoryDiscounts,
        promotions: promos,
        roundingRules,
      },
    });
  }
  return result;
}

export interface PriceRequest {
  variantId: string;
  qtyBase: number;
}

/** Preise für mehrere Positionen eines Betrachters (Shop, Warenkorb, Checkout, Vorschau). */
export async function priceItems(
  items: PriceRequest[],
  viewer: PricingViewer,
  date = new Date(),
  quoteId?: string | null,
): Promise<Map<string, PriceResult>> {
  const customer = viewer.channel !== "B2B" ? null : viewer.groupId ? await loadPricingGroup(viewer.groupId) : await loadPricingCustomer(viewer.customerId);
  const products = await loadPricingProducts(
    items.map((i) => i.variantId),
    customer,
    date,
    viewer.channel,
    quoteId,
  );
  const out = new Map<string, PriceResult>();
  for (const item of items) {
    const p = products.get(item.variantId);
    if (p) out.set(`${item.variantId}:${item.qtyBase}`, resolvePrice(p, customer, item.qtyBase, date, viewer.channel));
  }
  return out;
}

export function priceKey(variantId: string, qtyBase: number) {
  return `${variantId}:${qtyBase}`;
}
