"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const next = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      lang={next}
      disabled={pending}
      data-testid="language-switcher"
      className={className ?? "rounded-lg px-3 py-1.5 text-sm font-medium text-ink-700 ring-1 ring-ink-300 hover:bg-ink-100"}
      onClick={() =>
        startTransition(() => {
          const qs = search.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: next });
        })
      }
    >
      {t("switchTo")}
    </button>
  );
}
