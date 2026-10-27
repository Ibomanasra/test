import type { DocLang, I18nText } from "./model";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]!);
}

export function isI18n(v: unknown): v is I18nText {
  return typeof v === "object" && v !== null && "ar" in v && "en" in v;
}

/** Text in der Dokumentsprache; zweisprachig: Arabisch, darunter Englisch (klein) */
export function tx(value: string | I18nText | null | undefined, lang: DocLang): string {
  if (value == null) return "";
  if (!isI18n(value)) return esc(value);
  const ar = value.ar || value.en;
  const en = value.en || value.ar;
  if (lang === "ar") return esc(ar);
  if (lang === "en") return esc(en);
  return ar === en ? esc(ar) : `<span class="bi-ar">${esc(ar)}</span><span class="bi-en"><bdi>${esc(en)}</bdi></span>`;
}

/** Einzeilig (für Kopf-/Fußzeilen): „عربي · English“ */
export function txInline(value: I18nText, lang: DocLang): string {
  if (lang === "ar") return esc(value.ar);
  if (lang === "en") return esc(value.en);
  return value.ar === value.en ? esc(value.ar) : `${esc(value.ar)} · ${esc(value.en)}`;
}

export const dirOf = (lang: DocLang) => (lang === "en" ? "ltr" : "rtl");
