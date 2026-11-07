/**
 * Angebote auf Bestellebene: Willkommensrabatt, Rabatt ab Bestellwert,
 * Gutschein-Codes und Gratis-Lieferung. Reine Logik, ohne Datenbank.
 *
 * Regeln:
 * - Höchstens EIN Warenrabatt je Bestellung (der für den Kunden beste);
 *   Gratis-Lieferung kommt zusätzlich dazu.
 * - Der Rabatt wird anteilig auf die Stückpreise verteilt – so bleiben Positionen,
 *   MwSt., Rechnung und Marge ohne Sonderzeile korrekt.
 */
import { type Agorot, BPS_SCALE, roundDiv } from "./money";

export type OfferKind = "WELCOME" | "CART_THRESHOLD" | "COUPON" | "FREE_DELIVERY";
export type OfferChannel = "B2C" | "B2B";

export interface OfferRule {
  id: string;
  kind: OfferKind;
  channel: OfferChannel | "BOTH";
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  percentBps: number | null;
  amountAgorot: number | null;
  minOrderAgorot: number;
  code: string | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
}

export interface OfferContext {
  channel: OfferChannel;
  /** Warenwert ohne Lieferung (B2C brutto / B2B netto) */
  goodsValue: Agorot;
  now: Date;
  /** Kunde hat noch keine (nicht stornierte) Bestellung */
  firstOrder: boolean;
  /** eingegebener Gutschein-Code (beliebige Schreibweise) */
  couponCode?: string | null;
  /** bisherige Einlösungen dieses Kunden je Angebot */
  usesByCustomer?: ReadonlyMap<string, number>;
}

export type OfferRejection = "inactive" | "not_started" | "ended" | "channel" | "min_order" | "not_first_order" | "used_up" | "customer_limit" | "wrong_code";

export const normalizeCouponCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

/** Prüft ein einzelnes Angebot; `null` = anwendbar, sonst der Grund */
export function checkOffer(rule: OfferRule, ctx: OfferContext): OfferRejection | null {
  if (!rule.active) return "inactive";
  if (rule.startsAt && rule.startsAt > ctx.now) return "not_started";
  if (rule.endsAt && rule.endsAt <= ctx.now) return "ended";
  if (rule.channel !== "BOTH" && rule.channel !== ctx.channel) return "channel";
  if (rule.kind === "COUPON") {
    if (!ctx.couponCode || !rule.code || normalizeCouponCode(ctx.couponCode) !== normalizeCouponCode(rule.code)) return "wrong_code";
  }
  if (rule.kind === "WELCOME" && !ctx.firstOrder) return "not_first_order";
  if (rule.maxUses != null && rule.usedCount >= rule.maxUses) return "used_up";
  if (rule.perCustomerLimit != null && (ctx.usesByCustomer?.get(rule.id) ?? 0) >= rule.perCustomerLimit) return "customer_limit";
  if (ctx.goodsValue < rule.minOrderAgorot) return "min_order";
  return null;
}

/** Rabattbetrag eines Angebots auf den Warenwert (nie mehr als der Warenwert) */
export function offerDiscountAmount(rule: Pick<OfferRule, "kind" | "percentBps" | "amountAgorot">, goodsValue: Agorot): Agorot {
  if (rule.kind === "FREE_DELIVERY" || goodsValue <= 0) return 0;
  let d = 0;
  if (rule.percentBps) d = roundDiv(goodsValue * rule.percentBps, BPS_SCALE);
  else if (rule.amountAgorot) d = rule.amountAgorot;
  return Math.max(0, Math.min(d, goodsValue));
}

export interface OfferResult<R extends OfferRule = OfferRule> {
  /** bester Warenrabatt */
  discount: { rule: R; amount: Agorot } | null;
  /** Gratis-Lieferung durch Aktion */
  freeDelivery: R | null;
  /** Status des eingegebenen Gutscheins */
  coupon: { status: "applied" | "not_better" | "invalid"; reason?: OfferRejection; rule?: R } | null;
}

/** Wählt den besten Warenrabatt und eine eventuelle Gratis-Lieferung */
export function resolveOffers<R extends OfferRule>(rules: readonly R[], ctx: OfferContext): OfferResult<R> {
  let best: { rule: R; amount: Agorot } | null = null;
  let freeDelivery: R | null = null;
  for (const r of rules) {
    if (checkOffer(r, ctx)) continue;
    if (r.kind === "FREE_DELIVERY") {
      freeDelivery ??= r;
      continue;
    }
    const amount = offerDiscountAmount(r, ctx.goodsValue);
    if (amount > 0 && (!best || amount > best.amount)) best = { rule: r, amount };
  }
  let coupon: OfferResult<R>["coupon"] = null;
  if (ctx.couponCode?.trim()) {
    const code = normalizeCouponCode(ctx.couponCode);
    const rule = rules.find((r) => r.kind === "COUPON" && r.code && normalizeCouponCode(r.code) === code);
    if (!rule) coupon = { status: "invalid", reason: "wrong_code" };
    else {
      const reason = checkOffer(rule, ctx);
      if (reason) coupon = { status: "invalid", reason, rule };
      else coupon = { status: best?.rule.id === rule.id ? "applied" : "not_better", rule };
    }
  }
  return { discount: best, freeDelivery, coupon };
}

/**
 * Verteilt einen Rabatt anteilig auf Stückpreise. Gibt neue Stückpreise zurück;
 * die Summe weicht durch Rundung höchstens um wenige Agorot vom Wunschrabatt ab.
 */
export function distributeDiscount(units: readonly { unitPrice: Agorot; qty: number }[], discount: Agorot): Agorot[] {
  const goods = units.reduce((a, u) => a + u.unitPrice * u.qty, 0);
  if (discount <= 0 || goods <= 0) return units.map((u) => u.unitPrice);
  return units.map((u) => Math.max(0, u.unitPrice - roundDiv(u.unitPrice * discount, goods)));
}

/** Nächste erreichbare Stufe „ab Bestellwert“ als Anreiz („noch 50 ₪ bis 5 %“) */
export function nextThreshold<R extends OfferRule>(rules: readonly R[], ctx: OfferContext): { rule: R; missing: Agorot } | null {
  let out: { rule: R; missing: Agorot } | null = null;
  for (const r of rules) {
    if (r.kind !== "CART_THRESHOLD") continue;
    if (checkOffer(r, ctx) !== "min_order") continue;
    const missing = r.minOrderAgorot - ctx.goodsValue;
    if (!out || missing < out.missing) out = { rule: r, missing };
  }
  return out;
}
