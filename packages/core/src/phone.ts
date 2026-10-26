import { normalizeDigits } from "./money";

/**
 * Telefonnummern werden als E.164 gespeichert (+970… / +972…).
 *
 * Lokale Eingaben:
 *  - 059x / 056x (Jawwal, Ooredoo)          → +970
 *  - 02, 04, 08, 09 (Festnetz Westbank)     → +970
 *  - andere 05x (z. B. Jerusalem, israelische Netze) → +972
 */

export class PhoneError extends Error {
  override name = "PhoneError";
}

const PS_MOBILE = /^5[69]\d{7}$/;
const IL_MOBILE = /^5[0-58]\d{7}$/;
const LANDLINE = /^[2489]\d{7}$/;

export function normalizePhone(input: string): string {
  let s = normalizeDigits(input).replace(/[\s\-().‎‏]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;

  if (s.startsWith("+970") || s.startsWith("+972")) {
    const cc = s.slice(1, 4);
    let rest = s.slice(4);
    if (rest.startsWith("0")) rest = rest.slice(1);
    if (PS_MOBILE.test(rest) || IL_MOBILE.test(rest) || LANDLINE.test(rest)) return `+${cc}${rest}`;
    throw new PhoneError(`invalid phone number "${input}"`);
  }
  if (s.startsWith("+")) {
    if (/^\+\d{8,15}$/.test(s)) return s;
    throw new PhoneError(`invalid phone number "${input}"`);
  }
  if (s.startsWith("0")) s = s.slice(1);
  if (PS_MOBILE.test(s) || LANDLINE.test(s)) return `+970${s}`;
  if (IL_MOBILE.test(s)) return `+972${s}`;
  throw new PhoneError(`invalid phone number "${input}"`);
}

export function isValidPhone(input: string): boolean {
  try {
    normalizePhone(input);
    return true;
  } catch {
    return false;
  }
}

export function isMobile(e164: string): boolean {
  return /^\+97[02]5\d{8}$/.test(e164);
}

/** Anzeigeform: +970 59 912 3456 */
export function formatPhone(e164: string): string {
  const m = /^\+(97[02])(\d{2})(\d{3})(\d{4})$/.exec(e164);
  if (m) return `+${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  const l = /^\+(97[02])(\d)(\d{3})(\d{4})$/.exec(e164);
  if (l) return `+${l[1]} ${l[2]} ${l[3]} ${l[4]}`;
  return e164;
}

/** Maskiert für Logs/UI: +970 59 *** 3456 */
export function maskPhone(e164: string): string {
  return e164.replace(/^(\+\d{3}\d{2})\d+(\d{4})$/, "$1***$2");
}
