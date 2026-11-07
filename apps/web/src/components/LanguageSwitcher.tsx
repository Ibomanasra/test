"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_NAMES, locales, type AppLocale } from "@/i18n/routing";
import { cn } from "@/components/ui";

/** Sprachauswahl: Arabisch, Englisch, Hebräisch */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        disabled={pending}
        data-testid="language-switcher"
        className={cn(
          "cursor-pointer appearance-none rounded-lg bg-white py-1.5 pe-7 ps-3 text-sm font-medium text-ink-700 ring-1 ring-ink-300 hover:bg-ink-100",
          className,
        )}
        onChange={(e) => {
          const next = e.target.value as AppLocale;
          startTransition(() => {
            const qs = search.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: next });
          });
        }}
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-500">▼</span>
    </label>
  );
}
