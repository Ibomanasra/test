import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    timeZone: "Asia/Hebron",
    messages: (await import(`../messages/${locale}.json`)).default,
    formats: {
      number: { integer: { maximumFractionDigits: 0, numberingSystem: "latn" } },
      dateTime: {
        short: { day: "2-digit", month: "2-digit", year: "numeric", numberingSystem: "latn" },
        long: { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" },
      },
    },
  };
});
