/**
 * Verwaltung (Phase 5) – reine Berechnungen:
 *  - Einstandspreis nach Wareneingang (letzter Preis oder gleitender Durchschnitt)
 *  - Zahlungszuordnung zu offenen Rechnungen (älteste Fälligkeit zuerst)
 *  - Altersstruktur offener Posten, Mahnstufe
 *  - Kassenabschluss (Soll/Ist/Differenz), Inventurdifferenz
 */
import { roundDiv, type Agorot } from "./money";

export class OperationsError extends Error {}

// --- Wareneingang ------------------------------------------------------------

export type CostUpdateMode = "LAST" | "WEIGHTED_AVG";

/** Neuer Einstandspreis je Basiseinheit; Bestand ≤ 0 → Eingangspreis */
export function newCostPrice(mode: CostUpdateMode, onHand: number, currentCost: Agorot, receivedQty: number, receivedCost: Agorot): Agorot {
  if (!Number.isSafeInteger(receivedQty) || receivedQty <= 0) throw new OperationsError("invalid received quantity");
  if (mode === "LAST" || onHand <= 0) return receivedCost;
  return roundDiv(onHand * currentCost + receivedQty * receivedCost, onHand + receivedQty);
}

export type PurchaseStatus = "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

/** Status einer Einkaufsbestellung aus den Positionsmengen */
export function purchaseStatusFor(items: readonly { orderedBase: number; receivedBase: number }[]): "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" {
  const any = items.some((i) => i.receivedBase > 0);
  const all = items.length > 0 && items.every((i) => i.receivedBase >= i.orderedBase);
  return all ? "RECEIVED" : any ? "PARTIALLY_RECEIVED" : "ORDERED";
}

// --- Zahlungen ---------------------------------------------------------------

export interface OpenInvoice {
  id: string;
  dueDate: Date;
  open: Agorot;
}

/**
 * Verteilt eine Zahlung auf offene Rechnungen: ausgewählte (in Reihenfolge) oder
 * automatisch nach ältester Fälligkeit. Rest bleibt als Guthaben (unallocated).
 */
export function allocatePayment(amount: Agorot, invoices: readonly OpenInvoice[], selected?: readonly string[]): { allocations: { invoiceId: string; amount: Agorot }[]; unallocated: Agorot } {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new OperationsError("invalid amount");
  const pool = selected?.length
    ? selected.map((id) => {
        const inv = invoices.find((i) => i.id === id);
        if (!inv) throw new OperationsError(`invoice ${id} not open`);
        return inv;
      })
    : [...invoices].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.id.localeCompare(b.id));
  let rest = amount;
  const allocations: { invoiceId: string; amount: Agorot }[] = [];
  for (const inv of pool) {
    if (rest <= 0) break;
    const take = Math.min(rest, inv.open);
    if (take <= 0) continue;
    allocations.push({ invoiceId: inv.id, amount: take });
    rest -= take;
  }
  return { allocations, unallocated: rest };
}

// --- Offene Posten -----------------------------------------------------------

export const AGING_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function daysOverdue(dueDate: Date, today: Date): number {
  return Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000));
}

export function agingBucket(dueDate: Date, today: Date): AgingBucket {
  const d = daysOverdue(dueDate, today);
  if (d === 0) return "current";
  if (d <= 30) return "d1_30";
  if (d <= 60) return "d31_60";
  if (d <= 90) return "d61_90";
  return "d90_plus";
}

export function agingSummary(items: readonly { dueDate: Date; open: Agorot }[], today: Date): Record<AgingBucket | "total", Agorot> {
  const out = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };
  for (const i of items) {
    out[agingBucket(i.dueDate, today)] += i.open;
    out.total += i.open;
  }
  return out;
}

/** Nächste Mahnstufe (1–3) – frühestens `minDaysBetween` Tage nach der letzten; null = keine Mahnung fällig */
export function nextDunningLevel(oldestDaysOverdue: number, last: { level: number; issuedAt: Date } | null, today: Date, opts = { graceDays: 7, minDaysBetween: 14 }): number | null {
  if (oldestDaysOverdue < opts.graceDays) return null;
  if (!last) return 1;
  if (last.level >= 3) return null;
  if (daysOverdue(last.issuedAt, today) < opts.minDaysBetween) return null;
  return last.level + 1;
}

// --- Kasse / Inventur ---------------------------------------------------------

export function cashDifference(expected: Agorot, counted: Agorot): Agorot {
  return counted - expected;
}

/** Summe gezählter Scheine/Münzen: { "20000": 3, "50": 4 } (Nennwert in Agorot → Anzahl) */
export function sumDenominations(d: Record<string, number>): Agorot {
  return Object.entries(d).reduce((a, [value, count]) => {
    const v = Number(value);
    if (!Number.isSafeInteger(v) || v <= 0 || !Number.isSafeInteger(count) || count < 0) throw new OperationsError("invalid denomination");
    return a + v * count;
  }, 0);
}

export const ILS_DENOMINATIONS = [20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50, 10] as const;

export function stocktakeVariance(lines: readonly { expected: number; counted: number | null }[]) {
  let counted = 0;
  let plus = 0;
  let minus = 0;
  for (const l of lines) {
    if (l.counted == null) continue;
    counted++;
    const d = l.counted - l.expected;
    if (d > 0) plus += d;
    if (d < 0) minus += -d;
  }
  return { counted, uncounted: lines.length - counted, plus, minus };
}
