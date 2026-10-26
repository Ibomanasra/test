/**
 * Belegnummern: {PREFIX}-{JAHR}-{laufende Nummer, 6-stellig} → "INV-2026-000123".
 *
 * Der Zähler läuft pro Dokumentart und Kalenderjahr (Zeitzone Asia/Hebron).
 * Die eigentliche Vergabe (Zeilensperre in derselben Transaktion wie der Beleg)
 * liegt in packages/db/src/numbering.ts; hier ist nur die reine Logik.
 */

export const DOC_TYPES = [
  "QUOTE",
  "ORDER_CONFIRMATION",
  "PICK_LIST",
  "DELIVERY_NOTE",
  "INVOICE",
  "RECEIPT",
  "CREDIT_NOTE",
  "TOUR_SHEET",
  "CASH_CLOSING",
  "ACCOUNT_STATEMENT",
  "DUNNING",
  "PURCHASE_ORDER",
  "GOODS_RECEIPT",
  "PRICE_LIST",
  "STOCKTAKE",
  "STOCK_LIST",
  "REPORT",
  "ORDER",
  "RETURN",
] as const;

export type DocTypeKey = (typeof DOC_TYPES)[number];

export const DOC_PREFIX: Record<DocTypeKey, string> = {
  QUOTE: "QT",
  ORDER_CONFIRMATION: "OC",
  PICK_LIST: "PL",
  DELIVERY_NOTE: "DN",
  INVOICE: "INV",
  RECEIPT: "RC",
  CREDIT_NOTE: "CN",
  TOUR_SHEET: "TR",
  CASH_CLOSING: "CC",
  ACCOUNT_STATEMENT: "ST",
  DUNNING: "DU",
  PURCHASE_ORDER: "PO",
  GOODS_RECEIPT: "GR",
  PRICE_LIST: "PRL",
  STOCKTAKE: "SK",
  STOCK_LIST: "SL",
  REPORT: "RP",
  ORDER: "SO",
  RETURN: "RT",
};

/** Nur diese Belegarten müssen fortlaufend und lückenlos sein (D15). */
export const GAPLESS_DOC_TYPES: ReadonlySet<DocTypeKey> = new Set(["INVOICE", "CREDIT_NOTE"]);

export const DEFAULT_PADDING = 6;
export const BUSINESS_TIME_ZONE = "Asia/Hebron";

export class NumberingError extends Error {
  override name = "NumberingError";
}

export interface DocNumberParts {
  prefix: string;
  year: number;
  seq: number;
}

const PREFIX_RE = /^[A-Z]{1,6}$/;

export function formatDocNumber(parts: DocNumberParts, padding = DEFAULT_PADDING): string {
  const { prefix, year, seq } = parts;
  if (!PREFIX_RE.test(prefix)) throw new NumberingError(`invalid prefix "${prefix}"`);
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new NumberingError(`invalid year ${year}`);
  }
  if (!Number.isSafeInteger(seq) || seq < 1) throw new NumberingError(`invalid sequence ${seq}`);
  if (!Number.isInteger(padding) || padding < 1 || padding > 12) {
    throw new NumberingError(`invalid padding ${padding}`);
  }
  // Läuft der Zähler über die Stellenzahl hinaus, wird die Nummer länger statt abgeschnitten.
  return `${prefix}-${year}-${String(seq).padStart(padding, "0")}`;
}

export function parseDocNumber(value: string): DocNumberParts {
  const m = /^([A-Z]{1,6})-(\d{4})-(\d{1,12})$/.exec(value.trim());
  if (!m) throw new NumberingError(`invalid document number "${value}"`);
  const seq = Number(m[3]);
  if (seq < 1) throw new NumberingError(`invalid document number "${value}"`);
  return { prefix: m[1]!, year: Number(m[2]), seq };
}

/** Kalenderjahr eines Zeitpunkts in der Geschäftszeitzone (Silvester 23:30 UTC ist in Hebron schon Neujahr). */
export function businessYear(date: Date, timeZone = BUSINESS_TIME_ZONE): number {
  const year = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(date);
  return Number(year);
}

/** Kalendertag (YYYY-MM-DD) in der Geschäftszeitzone, z. B. für Kassenabschluss und Touren. */
export function businessDate(date: Date, timeZone = BUSINESS_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Prüft eine sortierte Nummernfolge auf Lücken und Doppelte (für Tests und den
 * Integritätsbericht der Buchhaltung). Gibt fehlende und doppelte Sequenzen zurück.
 */
export function findSequenceGaps(seqs: readonly number[]): { missing: number[]; duplicates: number[] } {
  const sorted = [...seqs].sort((a, b) => a - b);
  const missing: number[] = [];
  const duplicates: number[] = [];
  let expected = 1;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]!;
    if (i > 0 && s === sorted[i - 1]) {
      duplicates.push(s);
      continue;
    }
    while (expected < s) missing.push(expected++);
    expected = s + 1;
  }
  return { missing, duplicates };
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2027-01-01" → Zeitpunkt 00:00 Ortszeit (Asia/Hebron), sommerzeitfest. */
export function startOfBusinessDay(ymd: string, timeZone = BUSINESS_TIME_ZONE): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new NumberingError(`invalid date "${ymd}"`);
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  let result = guess - timeZoneOffsetMs(new Date(guess), timeZone);
  // Zweiter Durchlauf, falls der Offset am Ergebnis ein anderer ist (DST-Wechseltag)
  result = guess - timeZoneOffsetMs(new Date(result), timeZone);
  return new Date(result);
}
