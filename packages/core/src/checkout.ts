/**
 * Checkout-Berechnung (rein, serverseitig genutzt):
 *  - Positionen aus Preisergebnissen (B2B netto, B2C brutto) → Steuerzeilen
 *  - Liefergebühr je Gebiet und Kanal (brutto gepflegt), Gratis-Grenze
 *  - Mindestbestellwert (B2C brutto, B2B netto)
 *  - Kreditlimit für Kauf auf Rechnung
 */
import { type Agorot, type Bps } from "./money";
import { lineFromGross, lineFromNet, sumTaxLines, type TaxLine, type TaxTotals } from "./tax";

export type CheckoutChannel = "B2C" | "B2B";

export interface PricedLine {
  /** Stückpreis in Kanaldarstellung (B2B netto, B2C brutto) */
  unitPrice: Agorot;
  /** zu zahlende Menge in Basiseinheiten (ohne Gratis-Menge) */
  payableQtyBase: number;
  taxRateBps: Bps;
}

export interface ZoneRate {
  feeGrossAgorot: Agorot;
  minOrderAgorot: Agorot;
  freeFromAgorot: Agorot | null;
}

export interface CheckoutTotals extends TaxTotals {
  lines: TaxLine[];
  /** Warenwert in Kanaldarstellung (B2C brutto / B2B netto) – Basis für Mindestwert und Gratis-Grenze */
  goodsValue: Agorot;
  deliveryFee: TaxLine | null;
  deliveryFeeGross: Agorot;
  minimumOrder: Agorot;
  belowMinimum: boolean;
  freeDelivery: boolean;
}

export function lineFor(channel: CheckoutChannel, l: PricedLine): TaxLine {
  return channel === "B2B" ? lineFromNet(l.unitPrice, l.payableQtyBase, l.taxRateBps) : lineFromGross(l.unitPrice, l.payableQtyBase, l.taxRateBps);
}

export function computeCheckout(channel: CheckoutChannel, lines: readonly PricedLine[], rate: ZoneRate | null, deliveryTaxRateBps: Bps): CheckoutTotals {
  const taxLines = lines.map((l) => lineFor(channel, l));
  const goods = sumTaxLines(taxLines);
  const goodsValue = channel === "B2B" ? goods.net : goods.gross;
  const freeDelivery = !!rate && rate.freeFromAgorot !== null && goodsValue >= rate.freeFromAgorot;
  const feeGross = rate && !freeDelivery ? rate.feeGrossAgorot : 0;
  const deliveryFee = feeGross > 0 ? lineFromGross(feeGross, 1, deliveryTaxRateBps) : null;
  const totals = sumTaxLines(deliveryFee ? [...taxLines, deliveryFee] : taxLines);
  const minimumOrder = rate?.minOrderAgorot ?? 0;
  return {
    ...totals,
    lines: taxLines,
    goodsValue,
    deliveryFee,
    deliveryFeeGross: feeGross,
    minimumOrder,
    belowMinimum: lines.length === 0 || goodsValue < minimumOrder,
    freeDelivery,
  };
}

/**
 * Kreditlimit: offener Saldo + offene (noch nicht berechnete) Bestellungen auf Rechnung
 * + diese Bestellung dürfen das Limit nicht überschreiten.
 */
export function creditAvailable(limit: Agorot, openBalance: Agorot, openOrders: Agorot): Agorot {
  return limit - openBalance - openOrders;
}

export function fitsCreditLimit(limit: Agorot, openBalance: Agorot, openOrders: Agorot, orderTotal: Agorot): boolean {
  return orderTotal <= creditAvailable(limit, openBalance, openOrders);
}

/**
 * Mögliche Liefertage: ab morgen (Bestellungen nach dem Annahmeschluss ab übermorgen),
 * nur an den Wochentagen des Gebiets (leer = täglich, Freitag ausgenommen wenn nicht ausdrücklich gesetzt).
 * Rückgabe als "YYYY-MM-DD" in Geschäftszeit.
 */
export function deliveryDates(
  todayYmd: string,
  hourNow: number,
  weekdays: readonly number[],
  count = 7,
  cutoffHour = 14,
): string[] {
  const out: string[] = [];
  const start = new Date(`${todayYmd}T12:00:00Z`);
  let offset = hourNow >= cutoffHour ? 2 : 1;
  while (out.length < count && offset < 60) {
    const d = new Date(start.getTime() + offset * 86_400_000);
    const wd = d.getUTCDay();
    const allowed = weekdays.length ? weekdays.includes(wd) : wd !== 5;
    if (allowed) out.push(d.toISOString().slice(0, 10));
    offset++;
  }
  return out;
}
