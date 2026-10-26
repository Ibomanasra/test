import { type Agorot, type Bps, BPS_SCALE, assertAgorot, assertBps, roundDiv } from "./money";

/**
 * Steuerlogik.
 *
 * Regeln (siehe DECISIONS.md D10/D11):
 *  - Es wird PRO POSITION auf Agorot gerundet, danach summiert.
 *  - B2B (Nettopreise): lineNet = unitNet × qty; lineVat = round(lineNet × rate).
 *  - B2C (Bruttopreise): lineGross = unitGross × qty (exakt der angezeigte Preis);
 *    lineNet = round(lineGross / (1 + rate)); lineVat = lineGross − lineNet.
 *    Dadurch gilt immer net + vat = gross, auf jeder Position und in der Summe.
 */

export interface TaxRateRecord {
  code: string;
  rateBps: Bps;
  validFrom: Date;
  validTo?: Date | null;
}

export class TaxError extends Error {
  override name = "TaxError";
}

/** Steuersatz, der am Stichtag gilt (validFrom ≤ date < validTo). Bei Überlappung gewinnt der jüngste. */
export function resolveTaxRate(
  rates: readonly TaxRateRecord[],
  date: Date,
  code = "STANDARD",
): TaxRateRecord {
  const t = date.getTime();
  const candidates = rates
    .filter(
      (r) =>
        r.code === code &&
        r.validFrom.getTime() <= t &&
        (r.validTo == null || t < r.validTo.getTime()),
    )
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
  const hit = candidates[0];
  if (!hit) throw new TaxError(`no tax rate "${code}" valid at ${date.toISOString()}`);
  return hit;
}

/** MwSt.-Betrag auf einen Nettobetrag. */
export function vatFromNet(net: Agorot, rateBps: Bps): Agorot {
  assertAgorot(net);
  assertBps(rateBps);
  return roundDiv(net * rateBps, BPS_SCALE);
}

export function netToGross(net: Agorot, rateBps: Bps): Agorot {
  return net + vatFromNet(net, rateBps);
}

/** Netto-Anteil eines Bruttobetrags (Rückrechnung). */
export function grossToNet(gross: Agorot, rateBps: Bps): Agorot {
  assertAgorot(gross);
  assertBps(rateBps);
  return roundDiv(gross * BPS_SCALE, BPS_SCALE + rateBps);
}

export interface TaxLine {
  net: Agorot;
  vat: Agorot;
  gross: Agorot;
  rateBps: Bps;
}

function assertQty(qty: number): void {
  if (!Number.isSafeInteger(qty) || qty < 0) {
    throw new TaxError(`quantity must be a non-negative integer, got ${qty}`);
  }
}

/** Position aus Netto-Stückpreis (B2B). */
export function lineFromNet(unitNet: Agorot, qty: number, rateBps: Bps): TaxLine {
  assertAgorot(unitNet, "unitNet");
  assertQty(qty);
  const net = unitNet * qty;
  assertAgorot(net, "lineNet");
  const vat = vatFromNet(net, rateBps);
  return { net, vat, gross: net + vat, rateBps };
}

/** Position aus Brutto-Stückpreis (B2C). */
export function lineFromGross(unitGross: Agorot, qty: number, rateBps: Bps): TaxLine {
  assertAgorot(unitGross, "unitGross");
  assertQty(qty);
  const gross = unitGross * qty;
  assertAgorot(gross, "lineGross");
  const net = grossToNet(gross, rateBps);
  return { net, vat: gross - net, gross, rateBps };
}

export interface TaxBreakdownEntry {
  rateBps: Bps;
  net: Agorot;
  vat: Agorot;
  gross: Agorot;
}

export interface TaxTotals {
  net: Agorot;
  vat: Agorot;
  gross: Agorot;
  /** Aufschlüsselung nach Steuersatz, aufsteigend sortiert (für Rechnungsfuß). */
  breakdown: TaxBreakdownEntry[];
}

/** Summiert bereits gerundete Positionen. */
export function sumTaxLines(lines: readonly TaxLine[]): TaxTotals {
  const byRate = new Map<number, TaxBreakdownEntry>();
  let net = 0;
  let vat = 0;
  for (const l of lines) {
    if (l.net + l.vat !== l.gross) {
      throw new TaxError(`inconsistent line: ${l.net} + ${l.vat} != ${l.gross}`);
    }
    net += l.net;
    vat += l.vat;
    const e = byRate.get(l.rateBps) ?? { rateBps: l.rateBps, net: 0, vat: 0, gross: 0 };
    e.net += l.net;
    e.vat += l.vat;
    e.gross += l.gross;
    byRate.set(l.rateBps, e);
  }
  const totals = { net, vat, gross: net + vat };
  for (const v of Object.values(totals)) assertAgorot(v, "total");
  return { ...totals, breakdown: [...byRate.values()].sort((a, b) => a.rateBps - b.rateBps) };
}

/** Brutto-Stückpreis für die Anzeige eines Netto-Preises (B2B "inkl. MwSt."-Hinweis). */
export function displayGrossFromNet(unitNet: Agorot, rateBps: Bps): Agorot {
  return netToGross(unitNet, rateBps);
}

/** Prüfung beim Speichern: Gültigkeitsbereiche dürfen sich für denselben Code nicht überlappen. */
export function findOverlappingRates(rates: readonly TaxRateRecord[]): [TaxRateRecord, TaxRateRecord][] {
  const out: [TaxRateRecord, TaxRateRecord][] = [];
  const end = (r: TaxRateRecord) => r.validTo?.getTime() ?? Number.POSITIVE_INFINITY;
  for (let i = 0; i < rates.length; i++) {
    for (let j = i + 1; j < rates.length; j++) {
      const a = rates[i]!;
      const b = rates[j]!;
      if (a.code !== b.code) continue;
      if (a.validFrom.getTime() < end(b) && b.validFrom.getTime() < end(a)) out.push([a, b]);
    }
  }
  return out;
}

export function assertNoOverlap(rates: readonly TaxRateRecord[]): void {
  const overlaps = findOverlappingRates(rates);
  if (overlaps.length > 0) {
    const [a, b] = overlaps[0]!;
    throw new TaxError(
      `tax rates overlap for code ${a.code}: ${a.validFrom.toISOString()} / ${b.validFrom.toISOString()}`,
    );
  }
}
