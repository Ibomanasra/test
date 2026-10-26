import "server-only";
import { businessDate, formatBps, formatMoney } from "@sa/core";

/** Anzeige: "1,234.50 ₪" */
export const money = (a: number | null | undefined) => (a == null ? "–" : formatMoney(a));
/** Formularwert: "1234.50" */
export const moneyInput = (a: number | null | undefined) => (a == null ? "" : formatMoney(a, { symbol: false, grouping: false }));
export const pct = (bps: number | null | undefined) => (bps == null ? "–" : formatBps(bps));
export const pctInput = (bps: number | null | undefined) => (bps == null ? "" : formatBps(bps).replace("%", ""));
/** "YYYY-MM-DD" in Asia/Hebron */
export const day = (d: Date | null | undefined) => (d ? businessDate(d) : "");
/** "YYYY-MM-DDTHH:mm" in Asia/Hebron für datetime-local */
export function dateTimeLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hebron",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
export const dateTimeText = (d: Date | null | undefined) => (d ? dateTimeLocal(d).replace("T", " ") : "–");
export const range = (from: Date | null | undefined, to: Date | null | undefined) =>
  from || to ? `${day(from) || "…"} → ${day(to) || "…"}` : "–";
