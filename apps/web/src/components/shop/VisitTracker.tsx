"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";

const SESSION = "sa-visit";
let last = { key: "", at: 0 };

/** Zählt Seitenaufrufe im Shop anonym (für die Seite „Besucher“ im Admin). */
export function VisitTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const locale = useLocale();
  const q = search.get("q") ?? undefined;
  const utm = search.get("utm_source") ?? search.get("ref") ?? undefined;
  useEffect(() => {
    const key = `${pathname}?${q ?? ""}`;
    if (last.key === key && Date.now() - last.at < 1500) return; // StrictMode/doppelte Effekte
    last = { key, at: Date.now() };
    let entry = false;
    try {
      entry = !sessionStorage.getItem(SESSION);
      sessionStorage.setItem(SESSION, "1");
    } catch {
      /* Speicher nicht verfügbar */
    }
    const app = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
    const body = JSON.stringify({ path: pathname, q, locale, app, ...(entry ? { entry, ref: document.referrer || undefined, utm } : {}) });
    fetch("/api/v1/t", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => undefined);
  }, [pathname, q, locale, utm]);
  return null;
}
