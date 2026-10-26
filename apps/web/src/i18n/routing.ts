import { defineRouting } from "next-intl/routing";

export const locales = ["ar", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "ar",
  localePrefix: "always",
  // Arabisch ist immer Standard (keine Umleitung nach Browsersprache); Wechsel per Umschalter/URL
  localeDetection: false,
  localeCookie: { name: "SA_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});

export function dirFor(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Intl-Locale mit lateinischen Ziffern (Vorgabe: 0–9 auch auf Arabisch).
 * "ar-u-nu-latn" → arabische Monatsnamen, aber 0–9.
 */
export function intlLocale(locale: string): string {
  return locale === "ar" ? "ar-u-nu-latn" : "en-GB";
}
