import { defineRouting } from "next-intl/routing";

export const locales = ["ar", "en", "he"] as const;
export type AppLocale = (typeof locales)[number];

/** Anzeigename jeder Sprache in der eigenen Sprache (für den Umschalter) */
export const LOCALE_NAMES: Record<AppLocale, string> = { ar: "العربية", en: "English", he: "עברית" };

export const routing = defineRouting({
  locales,
  defaultLocale: "ar",
  localePrefix: "always",
  // Arabisch ist immer Standard (keine Umleitung nach Browsersprache); Wechsel per Umschalter/URL
  localeDetection: false,
  localeCookie: { name: "SA_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});

export function dirFor(locale: string): "rtl" | "ltr" {
  return locale === "ar" || locale === "he" ? "rtl" : "ltr";
}

/**
 * Intl-Locale mit lateinischen Ziffern (Vorgabe: 0–9 auch auf Arabisch).
 * "ar-u-nu-latn" → arabische Monatsnamen, aber 0–9.
 */
export function intlLocale(locale: string): string {
  return locale === "ar" ? "ar-u-nu-latn" : locale === "he" ? "he-IL" : "en-GB";
}
