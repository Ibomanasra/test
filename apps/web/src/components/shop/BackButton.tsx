"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useEffect } from "react";

const KEY = "sa-prev-path";

/** Merkt sich die zuletzt besuchte Shop-Seite (für den Zurück-Pfeil) */
export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem(KEY, pathname);
      } catch {
        /* Speicher nicht verfügbar */
      }
    };
  }, [pathname]);
  return null;
}

/** Zurück an die Stelle, von der man kam (Browser stellt die Scroll-Position wieder her); sonst zur Produktliste */
export function BackButton({ fallback = "/products" }: { fallback?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const back = () => {
    let prev: string | null = null;
    try {
      prev = sessionStorage.getItem(KEY);
    } catch {
      /* Speicher nicht verfügbar */
    }
    if (prev && window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <button type="button" onClick={back} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50" data-testid="back-button">
      <svg viewBox="0 0 24 24" className="size-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t("back")}
    </button>
  );
}
