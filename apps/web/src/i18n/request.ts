import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type Messages = Record<string, unknown>;

/** Fehlende Übersetzungen fallen auf Englisch zurück (Hebräisch wird schrittweise ergänzt) */
function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && typeof base[k] === "object" ? merge(base[k] as Messages, v as Messages) : v;
  }
  return out;
}

async function loadMessages(locale: string): Promise<Messages> {
  const own = (await import(`../messages/${locale}.json`)).default as Messages;
  if (locale === "ar" || locale === "en") return own;
  return merge((await import("../messages/en.json")).default as Messages, own);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    timeZone: "Asia/Hebron",
    messages: await loadMessages(locale),
    formats: {
      number: { integer: { maximumFractionDigits: 0, numberingSystem: "latn" } },
      dateTime: {
        short: { day: "2-digit", month: "2-digit", year: "numeric", numberingSystem: "latn" },
        long: { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" },
      },
    },
  };
});
