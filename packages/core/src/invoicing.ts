/**
 * Rechnungs- und Gutschriftsberechnung (rein):
 *  - Rechnung je Lieferschein: berechnet wird die tatsächlich gelieferte Menge (D23)
 *  - Gratis-Menge („Kaufe X, bekomme Y“) anteilig zur Liefermenge
 *  - Liefergebühr als eigene Position (brutto gepflegt) auf der ersten Rechnung einer Bestellung
 *  - Gutschrift: ganze Position oder anteilige Menge; Summen bleiben exakt (net + vat = gross)
 */
import { type CheckoutChannel, lineFor } from "./checkout";
import { roundDiv, type Agorot, type Bps } from "./money";
import { lineFromGross, type TaxLine } from "./tax";

export class InvoicingError extends Error {}

export interface ShippedItemInput {
  unitPriceNet: Agorot;
  unitPriceGross: Agorot;
  vatRateBps: Bps;
  unitCode: string;
  unitFactor: number;
  /** bestellte Menge (Basiseinheit) */
  orderedQtyBase: number;
  /** Gratis-Menge der Bestellposition (Basiseinheit) */
  freeQtyBase: number;
  /** mit diesem Lieferschein geliefert (Basiseinheit) */
  shippedQtyBase: number;
}

export interface InvoiceLineCalc extends TaxLine {
  unitCode: string;
  unitFactor: number;
  qty: number;
  qtyBase: number;
  payableQtyBase: number;
  freeQtyBase: number;
}

/** Position einer Lieferschein-Rechnung */
export function shippedLine(channel: CheckoutChannel, i: ShippedItemInput): InvoiceLineCalc {
  if (i.shippedQtyBase <= 0 || i.shippedQtyBase > i.orderedQtyBase) throw new InvoicingError("invalid shipped quantity");
  const free = Math.min(i.shippedQtyBase, roundDiv(i.freeQtyBase * i.shippedQtyBase, i.orderedQtyBase));
  const payable = i.shippedQtyBase - free;
  const tl = lineFor(channel, { unitPrice: channel === "B2B" ? i.unitPriceNet : i.unitPriceGross, payableQtyBase: payable, taxRateBps: i.vatRateBps });
  const whole = i.shippedQtyBase % i.unitFactor === 0;
  return {
    ...tl,
    unitCode: whole ? i.unitCode : "PIECE",
    unitFactor: whole ? i.unitFactor : 1,
    qty: whole ? i.shippedQtyBase / i.unitFactor : i.shippedQtyBase,
    qtyBase: i.shippedQtyBase,
    payableQtyBase: payable,
    freeQtyBase: free,
  };
}

/** Liefergebühr (brutto) als Steuerzeile */
export function deliveryFeeLine(feeGross: Agorot, rateBps: Bps): TaxLine | null {
  return feeGross > 0 ? lineFromGross(feeGross, 1, rateBps) : null;
}

export interface CreditSource {
  qtyBase: number;
  lineNet: Agorot;
  lineVat: Agorot;
  lineGross: Agorot;
}

/** Gutschriftszeile: volle Menge → exakt die Rechnungswerte, sonst anteilig (netto/brutto gerundet, MwSt. = Differenz) */
export function creditLine(src: CreditSource, creditQtyBase: number): TaxLine {
  if (!Number.isSafeInteger(creditQtyBase) || creditQtyBase <= 0 || creditQtyBase > src.qtyBase) throw new InvoicingError("invalid credit quantity");
  if (creditQtyBase === src.qtyBase) return { net: src.lineNet, vat: src.lineVat, gross: src.lineGross, rateBps: 0 };
  const gross = roundDiv(src.lineGross * creditQtyBase, src.qtyBase);
  const net = roundDiv(src.lineNet * creditQtyBase, src.qtyBase);
  return { net, vat: gross - net, gross, rateBps: 0 };
}

export function documentTotals(lines: readonly { net: number; vat: number; gross: number }[]) {
  return lines.reduce((a, l) => ({ net: a.net + l.net, vat: a.vat + l.vat, gross: a.gross + l.gross }), { net: 0, vat: 0, gross: 0 });
}

/** Fälligkeit = Ausstellungsdatum + Zahlungsziel (Tage) */
export function dueDateFor(issue: Date, termDays: number | null | undefined): Date {
  return new Date(issue.getTime() + Math.max(0, termDays ?? 0) * 86_400_000);
}

/** Offener Betrag einer Rechnung */
export function invoiceOpenAmount(inv: { totalGross: number; paidAmount: number; creditedAmount: number }): number {
  return Math.max(0, inv.totalGross - inv.paidAmount - inv.creditedAmount);
}

export function invoiceStatusFor(inv: { totalGross: number; paidAmount: number; creditedAmount: number }): "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CREDITED" {
  if (inv.creditedAmount >= inv.totalGross) return "CREDITED";
  if (inv.paidAmount + inv.creditedAmount >= inv.totalGross) return "PAID";
  if (inv.paidAmount > 0) return "PARTIALLY_PAID";
  return "ISSUED";
}
