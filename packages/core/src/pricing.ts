/**
 * Preis-Engine (Abschnitt 3 / DECISIONS D23).
 *
 *   resolvePrice(product, customer, qty, date, channel)
 *
 * Reine Funktion: alle Regeln (Sonderpreise, Staffeln, Aktionen …) kommen bereits
 * geladen in `product.rules`. Ergebnis: Stückpreis (B2B netto / B2C brutto), beide
 * Darstellungen, die gewinnende Regel und eine vollständige Begründung (trace).
 *
 * B2B (netto, pro Basiseinheit):
 *   1. Angenommenes Angebot        – „fix“ gewinnt sofort
 *   2. Kundenspezifischer Sonderpreis – „fix“ gewinnt sofort
 *   3. Aktive B2B-Aktion
 *   4–6. Kette: Preisliste der Gruppe ODER Basispreis − Gruppenrabatt
 *        → Staffelpreis, falls günstiger → Kategorie-Rabatt
 *   Nicht-fixe Kandidaten (1, 2, 3, Kette) konkurrieren: günstigste Gesamtsumme gewinnt.
 * B2C (brutto):
 *   1. Aktive B2C-Aktion  2. b2cPrice  → Rundungsregel
 */
import { type Agorot, type Bps, BPS_SCALE, applyDiscount, applyIncrease, assertAgorot, roundDiv } from "./money";
import { grossToNet, netToGross } from "./tax";

export type PricingChannel = "B2C" | "B2B";

export type PriceRuleKey =
  | "QUOTE"
  | "CUSTOMER_PRICE"
  | "PROMOTION"
  | "GROUP_PRICE_LIST"
  | "GROUP_DISCOUNT"
  | "BASE_PRICE"
  | "TIER_PRICE"
  | "CATEGORY_DISCOUNT"
  | "B2C_PRICE"
  | "MANUAL_OVERRIDE";

export type RoundingModeKey = "NONE" | "END_90" | "END_00" | "END_50_OR_00" | "NEAREST_10";

interface Validity {
  validFrom?: Date | null;
  validTo?: Date | null;
}

export interface QuoteLine {
  quoteId: string;
  unitPriceNet: Agorot;
  isFixed: boolean;
}

export interface CustomerPriceRule extends Validity {
  id: string;
  priceNet: Agorot;
  isFixed: boolean;
}

export interface PriceListItemRule extends Validity {
  id: string;
  priceListId: string;
  priceNet: Agorot;
}

export interface TierPriceRule extends Validity {
  id: string;
  groupId: string | null;
  minQtyBase: number;
  priceNet: Agorot;
}

export interface CategoryDiscountRule extends Validity {
  id: string;
  categoryId: string;
  groupId: string | null;
  customerId: string | null;
  discountBps: Bps;
}

export interface PromotionRule {
  id: string;
  channel: "B2C" | "B2B" | "BOTH";
  type: "PERCENT" | "FIXED_PRICE" | "BUY_X_GET_Y";
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  priority: number;
  percentBps?: Bps | null;
  buyQty?: number | null;
  getQty?: number | null;
  groupId?: string | null;
  /** FIXED_PRICE: B2C brutto / B2B netto (aus dem passenden PromotionTarget) */
  fixedPrice?: Agorot | null;
}

export interface RoundingRuleDef {
  mode: RoundingModeKey;
  minAgorot: number;
  appliesToPromotions: boolean;
  appliesToBasePrices: boolean;
  active: boolean;
  sortOrder: number;
}

export interface PricingProduct {
  variantId: string;
  /** Kategorie des Produkts + alle Oberkategorien (für Kategorie-Rabatte) */
  categoryIds: string[];
  costPrice: Agorot;
  b2cPrice: Agorot;
  b2bBasePrice: Agorot;
  taxRateBps: Bps;
  rules: {
    quote?: QuoteLine | null;
    customerPrices?: CustomerPriceRule[];
    priceListItems?: PriceListItemRule[];
    tierPrices?: TierPriceRule[];
    categoryDiscounts?: CategoryDiscountRule[];
    promotions?: PromotionRule[];
    roundingRules?: RoundingRuleDef[];
  };
}

export interface PricingCustomer {
  id: string;
  groupId: string | null;
  group?: {
    id: string;
    pricingMode: "DISCOUNT_PERCENT" | "PRICE_LIST";
    discountBps: Bps;
    priceListId: string | null;
  } | null;
}

export interface TraceEntry {
  rule: PriceRuleKey;
  ref?: string;
  /** Stückpreis dieses Kandidaten (Kanalwährung: B2B netto, B2C brutto) */
  unitPrice: Agorot;
  note: string;
  applied: boolean;
}

export interface PriceResult {
  channel: PricingChannel;
  /** Stückpreis in Kanaldarstellung: B2B netto, B2C brutto */
  unitPrice: Agorot;
  unitNet: Agorot;
  unitGross: Agorot;
  rule: PriceRuleKey;
  ruleRef: string | null;
  /** Gratis-Menge aus „Kaufe X, bekomme Y“ (Basiseinheiten) */
  freeQtyBase: number;
  /** Zu zahlende Menge = qty − freeQtyBase */
  payableQtyBase: number;
  trace: TraceEntry[];
  /** Listenpreis vor Rabatten (für Streichpreis-Anzeige) */
  listUnitPrice: Agorot;
  costPrice: Agorot;
  /** Marge auf den Nettopreis in Basispunkten (kann negativ sein) */
  marginBps: number;
}

export class PricingError extends Error {
  override name = "PricingError";
}

export function isValidAt(rule: Validity, date: Date): boolean {
  const t = date.getTime();
  if (rule.validFrom && rule.validFrom.getTime() > t) return false;
  if (rule.validTo && rule.validTo.getTime() <= t) return false;
  return true;
}

export function isPromotionActive(p: PromotionRule, date: Date, channel: PricingChannel, groupId: string | null): boolean {
  if (!p.active) return false;
  const t = date.getTime();
  if (p.startsAt.getTime() > t || p.endsAt.getTime() <= t) return false;
  if (p.channel !== "BOTH" && p.channel !== channel) return false;
  if (p.groupId && (channel !== "B2B" || p.groupId !== groupId)) return false;
  return true;
}

/** Rundet einen Bruttopreis nach Modus (nur aufwärts zu „Preisschwellen“, nie unter 0). */
export function applyRounding(gross: Agorot, mode: RoundingModeKey): Agorot {
  assertAgorot(gross);
  if (gross <= 0) return gross;
  switch (mode) {
    case "NONE":
      return gross;
    case "END_90": {
      const base = Math.floor(gross / 100) * 100;
      return gross % 100 <= 90 ? base + 90 : base + 190;
    }
    case "END_00":
      return Math.ceil(gross / 100) * 100;
    case "END_50_OR_00":
      return Math.ceil(gross / 50) * 50;
    case "NEAREST_10":
      return roundDiv(gross, 10) * 10;
  }
}

/** Erste passende aktive Rundungsregel (nach sortOrder) für einen Preis und dessen Herkunft. */
export function pickRoundingRule(
  rules: readonly RoundingRuleDef[] | undefined,
  gross: Agorot,
  kind: "promotion" | "base",
): RoundingRuleDef | null {
  if (!rules) return null;
  return (
    [...rules]
      .filter((r) => r.active && gross >= r.minAgorot && (kind === "promotion" ? r.appliesToPromotions : r.appliesToBasePrices))
      .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null
  );
}

/** Mindestpreis netto aus Einkaufspreis und Mindestmarge (Aufschlag auf den Einkaufspreis). */
export function minimumPriceNet(costPrice: Agorot, minMarginBps: Bps): Agorot {
  return applyIncrease(costPrice, minMarginBps);
}

export function isBelowMargin(unitNet: Agorot, costPrice: Agorot, minMarginBps: Bps): boolean {
  return unitNet < minimumPriceNet(costPrice, minMarginBps);
}

/** Marge auf den Verkaufspreis netto in Basispunkten. */
export function marginBpsOf(unitNet: Agorot, costPrice: Agorot): number {
  if (unitNet <= 0) return costPrice > 0 ? -BPS_SCALE : 0;
  return roundDiv((unitNet - costPrice) * BPS_SCALE, unitNet);
}

function freeUnits(qty: number, buy: number, get: number): number {
  if (buy < 1 || get < 1) return 0;
  return Math.floor(qty / (buy + get)) * get;
}

interface Candidate {
  rule: PriceRuleKey;
  ref?: string;
  unitPrice: Agorot;
  freeQtyBase: number;
  note: string;
  /** Reihenfolge bei Gleichstand (kleiner = Vorrang) */
  rank: number;
}

const totalOf = (c: Candidate, qty: number) => c.unitPrice * Math.max(0, qty - c.freeQtyBase);

function bestPromotion(
  promotions: readonly PromotionRule[] | undefined,
  date: Date,
  channel: PricingChannel,
  groupId: string | null,
  listPrice: Agorot,
  chainPrice: Agorot,
  qty: number,
  trace: TraceEntry[],
): Candidate | null {
  let best: Candidate | null = null;
  // Höhere Priorität zuerst; bei gleicher Gesamtsumme bleibt die höher priorisierte Aktion
  const sorted = [...(promotions ?? [])].sort((a, b) => b.priority - a.priority);
  for (const p of sorted) {
    if (!isPromotionActive(p, date, channel, groupId)) continue;
    let c: Candidate | null = null;
    if (p.type === "PERCENT" && p.percentBps != null) {
      c = { rule: "PROMOTION", ref: p.id, unitPrice: applyDiscount(listPrice, p.percentBps), freeQtyBase: 0, note: `-${p.percentBps}bps`, rank: 3 };
    } else if (p.type === "FIXED_PRICE" && p.fixedPrice != null) {
      c = { rule: "PROMOTION", ref: p.id, unitPrice: p.fixedPrice, freeQtyBase: 0, note: "fixed", rank: 3 };
    } else if (p.type === "BUY_X_GET_Y" && p.buyQty && p.getQty) {
      const free = freeUnits(qty, p.buyQty, p.getQty);
      c = { rule: "PROMOTION", ref: p.id, unitPrice: chainPrice, freeQtyBase: free, note: `buy ${p.buyQty} get ${p.getQty}: ${free} free`, rank: 3 };
    }
    if (!c) continue;
    trace.push({ rule: c.rule, ref: c.ref, unitPrice: c.unitPrice, note: `promotion ${c.note}`, applied: false });
    if (!best || totalOf(c, qty) < totalOf(best, qty)) best = c;
  }
  return best;
}

function finalize(
  channel: PricingChannel,
  product: PricingProduct,
  qty: number,
  winner: Candidate,
  listUnitPrice: Agorot,
  trace: TraceEntry[],
): PriceResult {
  for (const t of trace) t.applied = t.rule === winner.rule && t.ref === winner.ref && t.unitPrice === winner.unitPrice;
  const unitNet = channel === "B2B" ? winner.unitPrice : grossToNet(winner.unitPrice, product.taxRateBps);
  const unitGross = channel === "B2B" ? netToGross(winner.unitPrice, product.taxRateBps) : winner.unitPrice;
  return {
    channel,
    unitPrice: winner.unitPrice,
    unitNet,
    unitGross,
    rule: winner.rule,
    ruleRef: winner.ref ?? null,
    freeQtyBase: Math.min(winner.freeQtyBase, qty),
    payableQtyBase: Math.max(0, qty - winner.freeQtyBase),
    trace,
    listUnitPrice,
    costPrice: product.costPrice,
    marginBps: marginBpsOf(unitNet, product.costPrice),
  };
}

function resolveB2B(product: PricingProduct, customer: PricingCustomer | null, qty: number, date: Date): PriceResult {
  const r = product.rules;
  const trace: TraceEntry[] = [];
  const groupId = customer?.groupId ?? null;
  const group = customer?.group ?? null;

  // 1. Angebot
  const quote = r.quote ?? null;
  if (quote) {
    trace.push({ rule: "QUOTE", ref: quote.quoteId, unitPrice: quote.unitPriceNet, note: quote.isFixed ? "fixed" : "negotiated", applied: false });
    if (quote.isFixed) {
      return finalize("B2B", product, qty, { rule: "QUOTE", ref: quote.quoteId, unitPrice: quote.unitPriceNet, freeQtyBase: 0, note: "", rank: 1 }, product.b2bBasePrice, trace);
    }
  }

  // 2. Sonderpreis (jüngster gültiger)
  const special = (r.customerPrices ?? [])
    .filter((p) => isValidAt(p, date))
    .sort((a, b) => (b.validFrom?.getTime() ?? 0) - (a.validFrom?.getTime() ?? 0))[0];
  if (special) {
    trace.push({ rule: "CUSTOMER_PRICE", ref: special.id, unitPrice: special.priceNet, note: special.isFixed ? "fixed" : "special", applied: false });
    if (special.isFixed) {
      return finalize("B2B", product, qty, { rule: "CUSTOMER_PRICE", ref: special.id, unitPrice: special.priceNet, freeQtyBase: 0, note: "", rank: 2 }, product.b2bBasePrice, trace);
    }
  }

  // 4. Gruppenpreis: Preisliste ODER Basispreis − Gruppenrabatt
  let chain: Candidate = { rule: "BASE_PRICE", unitPrice: product.b2bBasePrice, freeQtyBase: 0, note: "base", rank: 4 };
  trace.push({ rule: "BASE_PRICE", unitPrice: product.b2bBasePrice, note: "b2bBasePrice", applied: false });
  if (group?.pricingMode === "PRICE_LIST" && group.priceListId) {
    const item = (r.priceListItems ?? []).find((i) => i.priceListId === group.priceListId && isValidAt(i, date));
    if (item) {
      chain = { rule: "GROUP_PRICE_LIST", ref: item.id, unitPrice: item.priceNet, freeQtyBase: 0, note: "price list", rank: 4 };
      trace.push({ rule: "GROUP_PRICE_LIST", ref: item.id, unitPrice: item.priceNet, note: `price list ${group.priceListId}`, applied: false });
    }
  } else if (group && group.discountBps > 0) {
    const price = applyDiscount(product.b2bBasePrice, group.discountBps);
    chain = { rule: "GROUP_DISCOUNT", ref: group.id, unitPrice: price, freeQtyBase: 0, note: `group -${group.discountBps}bps`, rank: 4 };
    trace.push({ rule: "GROUP_DISCOUNT", ref: group.id, unitPrice: price, note: `group -${group.discountBps}bps`, applied: false });
  }

  // 5. Staffel, falls günstiger (gruppenspezifische oder allgemeine)
  const tier = (r.tierPrices ?? [])
    .filter((t) => isValidAt(t, date) && t.minQtyBase <= qty && (t.groupId === null || t.groupId === groupId))
    .sort((a, b) => a.priceNet - b.priceNet)[0];
  if (tier) {
    const better = tier.priceNet < chain.unitPrice;
    trace.push({ rule: "TIER_PRICE", ref: tier.id, unitPrice: tier.priceNet, note: `from ${tier.minQtyBase}${better ? "" : " (not cheaper)"}`, applied: false });
    if (better) chain = { rule: "TIER_PRICE", ref: tier.id, unitPrice: tier.priceNet, freeQtyBase: 0, note: "tier", rank: 5 };
  }

  // 6. Kategorie-Rabatt (höchster passender für Kunde oder Gruppe)
  const catDiscount = (r.categoryDiscounts ?? [])
    .filter(
      (d) =>
        isValidAt(d, date) &&
        product.categoryIds.includes(d.categoryId) &&
        ((d.customerId !== null && d.customerId === customer?.id) || (d.groupId !== null && d.groupId === groupId)),
    )
    .sort((a, b) => b.discountBps - a.discountBps)[0];
  if (catDiscount) {
    const price = applyDiscount(chain.unitPrice, catDiscount.discountBps);
    trace.push({ rule: "CATEGORY_DISCOUNT", ref: catDiscount.id, unitPrice: price, note: `category -${catDiscount.discountBps}bps on ${chain.rule}`, applied: false });
    chain = { rule: "CATEGORY_DISCOUNT", ref: catDiscount.id, unitPrice: price, freeQtyBase: 0, note: "category", rank: 6 };
  }

  // Konkurrenz der nicht-fixen Kandidaten
  const candidates: Candidate[] = [chain];
  if (quote) candidates.push({ rule: "QUOTE", ref: quote.quoteId, unitPrice: quote.unitPriceNet, freeQtyBase: 0, note: "", rank: 1 });
  if (special) candidates.push({ rule: "CUSTOMER_PRICE", ref: special.id, unitPrice: special.priceNet, freeQtyBase: 0, note: "", rank: 2 });
  const promo = bestPromotion(r.promotions, date, "B2B", groupId, product.b2bBasePrice, chain.unitPrice, qty, trace);
  if (promo) candidates.push(promo);

  const winner = candidates.sort((a, b) => totalOf(a, qty) - totalOf(b, qty) || a.rank - b.rank)[0]!;
  return finalize("B2B", product, qty, winner, product.b2bBasePrice, trace);
}

function resolveB2C(product: PricingProduct, qty: number, date: Date): PriceResult {
  const r = product.rules;
  const trace: TraceEntry[] = [];

  let base = product.b2cPrice;
  const baseRule = pickRoundingRule(r.roundingRules, base, "base");
  if (baseRule) base = applyRounding(base, baseRule.mode);
  trace.push({ rule: "B2C_PRICE", unitPrice: base, note: baseRule ? `b2cPrice rounded ${baseRule.mode}` : "b2cPrice", applied: false });
  const baseCandidate: Candidate = { rule: "B2C_PRICE", unitPrice: base, freeQtyBase: 0, note: "", rank: 2 };

  let promo = bestPromotion(r.promotions, date, "B2C", null, product.b2cPrice, base, qty, trace);
  if (promo && promo.freeQtyBase === 0) {
    const rule = pickRoundingRule(r.roundingRules, promo.unitPrice, "promotion");
    if (rule) {
      const rounded = applyRounding(promo.unitPrice, rule.mode);
      trace.push({ rule: "PROMOTION", ref: promo.ref, unitPrice: rounded, note: `promotion rounded ${rule.mode}`, applied: false });
      promo = { ...promo, unitPrice: rounded };
    }
  }
  const candidates = promo ? [{ ...promo, rank: 1 }, baseCandidate] : [baseCandidate];
  const winner = candidates.sort((a, b) => totalOf(a, qty) - totalOf(b, qty) || a.rank - b.rank)[0]!;
  return finalize("B2C", product, qty, winner, product.b2cPrice, trace);
}

/**
 * Ermittelt den Stückpreis für eine Variante.
 * @param qty Menge in Basiseinheiten (für Staffeln und „Kaufe X, bekomme Y“)
 */
export function resolvePrice(
  product: PricingProduct,
  customer: PricingCustomer | null,
  qty: number,
  date: Date,
  channel: PricingChannel,
): PriceResult {
  if (!Number.isSafeInteger(qty) || qty < 1) throw new PricingError(`quantity must be a positive integer, got ${qty}`);
  for (const [k, v] of [["costPrice", product.costPrice], ["b2cPrice", product.b2cPrice], ["b2bBasePrice", product.b2bBasePrice]] as const) {
    assertAgorot(v, k);
    if (v < 0) throw new PricingError(`${k} must not be negative`);
  }
  return channel === "B2B" ? resolveB2B(product, customer, qty, date) : resolveB2C(product, qty, date);
}

// ---------------------------------------------------------------------------
// Mengenregeln (Mindestmenge / Mengenschritt pro Kanal)
// ---------------------------------------------------------------------------

export interface QuantityRule {
  minQtyBase: number;
  qtyStepBase: number;
}

export type QuantityProblem = "below_minimum" | "invalid_step" | "invalid_quantity";

export function checkQuantity(qtyBase: number, rule: QuantityRule): QuantityProblem | null {
  if (!Number.isSafeInteger(qtyBase) || qtyBase < 1) return "invalid_quantity";
  if (qtyBase < rule.minQtyBase) return "below_minimum";
  if (qtyBase % rule.qtyStepBase !== 0) return "invalid_step";
  return null;
}

// ---------------------------------------------------------------------------
// Massenpflege
// ---------------------------------------------------------------------------

/**
 * Prozentuale Preisänderung (z. B. +350 = +3,5 %). B2C-Preise (brutto) werden
 * optional anschließend nach Rundungsregel gerundet.
 */
export function bulkAdjust(price: Agorot, changeBps: number, rounding?: RoundingModeKey | null): Agorot {
  const next = applyIncrease(price, changeBps);
  return rounding ? applyRounding(next, rounding) : next;
}
