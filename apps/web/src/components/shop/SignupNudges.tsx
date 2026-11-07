"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";

const BANNER_KEY = "sa-guest-banner-hidden";
const INVITE_KEY = "sa-invite-dismissed";
const VIEWS_KEY = "sa-product-views";
const SNOOZE_MS = 3 * 86_400_000;

const read = (k: string, store: "local" | "session" = "local") => {
  try {
    return (store === "local" ? localStorage : sessionStorage).getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string, store: "local" | "session" = "local") => {
  try {
    (store === "local" ? localStorage : sessionStorage).setItem(k, v);
  } catch {
    /* Speicher nicht verfügbar */
  }
};
const snoozed = (k: string) => Date.now() - Number(read(k) ?? 0) < SNOOZE_MS;

/** Schmaler Streifen oben für Gäste: „Rabatt auf die erste Bestellung – Konto erstellen“ */
export function GuestBanner({ welcome }: { welcome: string | null }) {
  const t = useTranslations("shop.signup");
  const pathname = usePathname();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sichtbarkeit erst nach dem Laden aus localStorage
    setHidden(snoozed(BANNER_KEY));
  }, []);
  if (hidden || /\/(register|login|checkout)/.test(pathname)) return null;
  return (
    <div className="bg-gradient-to-l from-brand-700 to-red-600 text-white" data-testid="guest-banner">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm">
        <span aria-hidden>🎁</span>
        <p className="min-w-0 flex-1 truncate font-medium">
          {/* am Handy kurz, sonst ausführlich */}
          <span className="sm:hidden">{welcome ? t("perkWelcome", { value: welcome }) : t("bannerShort")}</span>
          <span className="hidden sm:inline">{welcome ? t("bannerWelcome", { value: welcome }) : t("bannerPlain")}</span>
        </p>
        <Link href="/register" className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-800 shadow hover:bg-brand-50" data-testid="banner-register">
          {t("cta")}
        </Link>
        <button type="button" onClick={() => { write(BANNER_KEY, String(Date.now())); setHidden(true); }} className="shrink-0 rounded-full p-1 text-white/80 hover:text-white" aria-label={t("close")}>✕</button>
      </div>
    </div>
  );
}

/**
 * Freundliches Einladungsfenster: nach dem 3. angesehenen Produkt oder nach 30 Sekunden,
 * höchstens einmal je Sitzung; „Später“ blendet es 3 Tage aus.
 */
export function SignupInvite({ welcome }: { welcome: string | null }) {
  const t = useTranslations("shop.signup");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const blocked = /\/(register|login|checkout|forgot-password|reset-password)/.test(pathname);

  useEffect(() => {
    if (blocked || snoozed(INVITE_KEY) || read("sa-invite-shown", "session")) return;
    const show = () => {
      if (read("sa-invite-shown", "session")) return;
      write("sa-invite-shown", "1", "session");
      setOpen(true);
    };
    // Produktansichten dieser Sitzung zählen
    if (/\/products\/[^/]+$/.test(pathname)) {
      // jedes Produkt nur einmal zählen
      const seen = new Set((read(VIEWS_KEY, "session") ?? "").split("|").filter(Boolean));
      seen.add(pathname);
      write(VIEWS_KEY, [...seen].join("|"), "session");
      if (seen.size >= 3) return show();
    }
    const timer = setTimeout(show, 30_000);
    return () => clearTimeout(timer);
  }, [pathname, blocked]);

  const later = () => {
    write(INVITE_KEY, String(Date.now()));
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        write(INVITE_KEY, String(Date.now()));
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open || blocked) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="invite-title" onClick={later}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} data-testid="signup-invite">
        <p className="text-3xl" aria-hidden>👋</p>
        <h2 id="invite-title" className="mt-2 text-xl font-bold text-ink-900">{t("inviteTitle")}</h2>
        <p className="mt-1 text-sm text-ink-600">{t("inviteText")}</p>
        <ul className="mt-4 space-y-2 text-sm text-ink-800">
          {welcome ? <li className="flex items-center gap-2 font-semibold text-red-700"><span className="grid size-6 place-items-center rounded-full bg-red-100">🎁</span>{t("perkWelcome", { value: welcome })}</li> : null}
          <li className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-green-100 text-green-700">✓</span>{t("perkTrack")}</li>
          <li className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-green-100 text-green-700">✓</span>{t("perkReorder")}</li>
          <li className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-green-100 text-green-700">✓</span>{t("perkOffers")}</li>
        </ul>
        <Link href="/register" onClick={() => write(INVITE_KEY, String(Date.now()))} className="mt-5 flex w-full items-center justify-center rounded-xl bg-brand-700 py-3 text-base font-bold text-white shadow hover:bg-brand-800" data-testid="invite-register">
          {t("inviteCta")}
        </Link>
        <div className="mt-2 flex items-center justify-between text-sm">
          <Link href="/login" onClick={() => write(INVITE_KEY, String(Date.now()))} className="text-brand-700 hover:underline">{t("haveAccount")}</Link>
          <button type="button" onClick={later} className="text-ink-500 hover:text-ink-800" data-testid="invite-later">{t("later")}</button>
        </div>
      </div>
    </div>
  );
}
