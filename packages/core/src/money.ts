/**
 * Geldbeträge sind immer ganze Agorot (1 ₪ = 100 Agorot) als `number`.
 * Prozentwerte sind Basispunkte (1600 = 16,00 %).
 *
 * Alle Produkte aus Betrag × Basispunkten bleiben weit unter
 * Number.MAX_SAFE_INTEGER (2^53): 10^10 Agorot × 10^4 bps = 10^14.
 */

export type Agorot = number;
export type Bps = number;

export const BPS_SCALE = 10_000;
export const AGOROT_PER_SHEKEL = 100;

export class MoneyError extends Error {
  override name = "MoneyError";
}

export function assertAgorot(value: number, label = "amount"): asserts value is Agorot {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of agorot, got ${value}`);
  }
}

export function assertBps(value: number, label = "bps"): asserts value is Bps {
  if (!Number.isSafeInteger(value) || value < 0 || value > BPS_SCALE) {
    throw new MoneyError(`${label} must be an integer between 0 and ${BPS_SCALE}, got ${value}`);
  }
}

/**
 * Ganzzahlige Division mit kaufmännischer Rundung (half away from zero).
 * roundDiv(5, 2) = 3, roundDiv(-5, 2) = -3.
 */
export function roundDiv(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new MoneyError(`roundDiv requires integers, got ${numerator}/${denominator}`);
  }
  if (denominator === 0) throw new MoneyError("division by zero");
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const q = Math.floor((2 * n + d) / (2 * d));
  return sign * q || 0;
}

/** Anteil `bps` von `amount`, auf Agorot gerundet. */
export function percentOf(amount: Agorot, bps: Bps): Agorot {
  assertAgorot(amount);
  assertBps(bps);
  return roundDiv(amount * bps, BPS_SCALE);
}

/** `amount` abzüglich `bps` Prozent, Ergebnis auf Agorot gerundet. */
export function applyDiscount(amount: Agorot, bps: Bps): Agorot {
  assertAgorot(amount);
  assertBps(bps);
  return roundDiv(amount * (BPS_SCALE - bps), BPS_SCALE);
}

/** `amount` zuzüglich `bps` Prozent (z. B. Preiserhöhung), auf Agorot gerundet. */
export function applyIncrease(amount: Agorot, bps: number): Agorot {
  assertAgorot(amount);
  if (!Number.isSafeInteger(bps) || bps < -BPS_SCALE) {
    throw new MoneyError(`increase bps must be an integer >= -${BPS_SCALE}, got ${bps}`);
  }
  return roundDiv(amount * (BPS_SCALE + bps), BPS_SCALE);
}

export function sumAgorot(values: readonly Agorot[]): Agorot {
  let total = 0;
  for (const v of values) {
    assertAgorot(v);
    total += v;
  }
  assertAgorot(total, "sum");
  return total;
}

/**
 * Verteilt `total` nach Gewichten (Largest-Remainder), sodass die Summe exakt stimmt.
 * Wird z. B. für Rabatte auf Belegebene oder Kostenumlagen genutzt.
 */
export function allocate(total: Agorot, weights: readonly number[]): Agorot[] {
  assertAgorot(total);
  if (weights.length === 0) throw new MoneyError("allocate requires at least one weight");
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new MoneyError("weights must be non-negative integers");
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) throw new MoneyError("weights must not all be zero");

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const shares = weights.map((w, index) => {
    const exact = abs * w;
    return { index, floor: Math.floor(exact / weightSum), remainder: exact % weightSum };
  });
  let rest = abs - shares.reduce((a, s) => a + s.floor, 0);
  const result = shares.map((s) => s.floor);
  const byRemainder = [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const s of byRemainder) {
    if (rest === 0) break;
    result[s.index]! += 1;
    rest -= 1;
  }
  return result.map((v) => v * sign || 0);
}

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Wandelt arabisch-indische Ziffern in lateinische um (Eingaben vom Handy). */
export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = ARABIC_INDIC.indexOf(ch);
    return String(a >= 0 ? a : EXTENDED_ARABIC_INDIC.indexOf(ch));
  });
}

/**
 * Parst einen Schekel-Betrag aus Text ohne Float-Arithmetik.
 * Akzeptiert "12", "12.5", "12,50", "1,234.50", "-3.10", "١٢٫٥٠", "₪ 12.90".
 */
export function parseShekel(input: string): Agorot {
  let s = normalizeDigits(input).replace(/[₪\s ‏‎]|ILS|NIS/gi, "");
  s = s.replace(/٫/g, ".").replace(/٬/g, ",");
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);
  // "1,234.50" → Tausendertrennzeichen entfernen; "12,50" → Dezimalkomma
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new MoneyError(`invalid shekel amount: "${input}"`);
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  const value = whole * AGOROT_PER_SHEKEL + frac;
  assertAgorot(value);
  return negative ? -value : value;
}

export interface FormatMoneyOptions {
  /** Währungssymbol anhängen (Standard: true) */
  symbol?: boolean;
  /** Tausendertrennzeichen (Standard: true) */
  grouping?: boolean;
  /** "+" bei positiven Beträgen (für Differenzen) */
  signed?: boolean;
}

/**
 * Formatiert Agorot deterministisch mit lateinischen Ziffern: "1,234.50 ₪".
 * Identisch in AR und EN (Vorgabe: lateinische Ziffern in beiden Sprachen).
 * Die Leserichtung regelt die UI (dir="ltr" auf Beträgen bzw. bdi).
 */
export function formatMoney(amount: Agorot, options: FormatMoneyOptions = {}): string {
  assertAgorot(amount);
  const { symbol = true, grouping = true, signed = false } = options;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / AGOROT_PER_SHEKEL);
  const frac = String(abs % AGOROT_PER_SHEKEL).padStart(2, "0");
  const wholeStr = grouping ? String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : String(whole);
  const sign = amount < 0 ? "-" : signed && amount > 0 ? "+" : "";
  return `${sign}${wholeStr}.${frac}${symbol ? " ₪" : ""}`;
}

/** Basispunkte als Prozenttext: 1600 → "16%", 825 → "8.25%". */
export function formatBps(bps: number): string {
  if (!Number.isSafeInteger(bps)) throw new MoneyError(`invalid bps ${bps}`);
  const sign = bps < 0 ? "-" : "";
  const abs = Math.abs(bps);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const fracStr = frac === 0 ? "" : `.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
  return `${sign}${whole}${fracStr}%`;
}

/** Prozenttext → Basispunkte: "16" → 1600, "8.25" → 825, "-5%" → -500. */
export function parsePercentToBps(input: string): number {
  const s = normalizeDigits(input).replace(/[%\s]/g, "").replace(/[٫,]/g, ".");
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new MoneyError(`invalid percent: "${input}"`);
  const value = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0"));
  return m[1] === "-" ? -value : value;
}
