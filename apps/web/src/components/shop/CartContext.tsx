"use client";

import { formatMoney } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/components/ui";
import { Link } from "@/i18n/navigation";

/** Was nach „In den Warenkorb“ angezeigt wird */
export interface AddedInfo {
  name: string;
  imageId: string | null;
  qty: number;
  unitName: string;
  /** Warenwert des ganzen Korbs (Agorot) */
  cartTotal: number;
  count: number;
}

interface CartCtx {
  count: number;
  setCount: (n: number) => void;
  notifyAdded: (info: AddedInfo) => void;
}

const Ctx = createContext<CartCtx>({ count: 0, setCount: () => undefined, notifyAdded: () => undefined });
export const useCart = () => useContext(Ctx);

/**
 * Warenkorb-Zustand im Shop: Zähler im Kopf ändert sich sofort (ohne Neuladen),
 * nach dem Hinzufügen erscheint eine kurze Bestätigung mit Foto und Links.
 */
export function CartProvider({ initialCount, children }: { initialCount: number; children: React.ReactNode }) {
  // Serverwert übernehmen, sobald er sich ändert (z. B. nach Neuladen/Anmeldung)
  const [state, setState] = useState({ base: initialCount, count: initialCount });
  if (state.base !== initialCount) setState({ base: initialCount, count: initialCount });
  const [added, setAdded] = useState<AddedInfo | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCount = useCallback((n: number) => setState((s) => ({ ...s, count: n })), []);
  const notifyAdded = useCallback((info: AddedInfo) => {
    setState((s) => ({ ...s, count: info.count }));
    setAdded(info);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(null), 4500);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ count: state.count, setCount, notifyAdded }), [state.count, setCount, notifyAdded]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <AddedToast info={added} onClose={() => setAdded(null)} />
    </Ctx.Provider>
  );
}

/** Warenkorb-Knopf im Kopf mit Zähler, der beim Ändern kurz „hüpft“ */
export function CartLink({ label }: { label: string }) {
  const { count } = useCart();
  return (
    <Link href="/cart" aria-label={count ? `${label} (${count})` : label} className="relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ring-1 ring-ink-300 hover:bg-ink-100" data-testid="cart-link">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="20" r="1.3" />
        <circle cx="17" cy="20" r="1.3" />
      </svg>
      <span className="hidden sm:inline" aria-hidden>{label}</span>
      {count > 0 ? (
        <span key={count} className="num absolute -end-2 -top-2 grid min-w-5 animate-[cart-bump_.45s_ease-out] place-items-center rounded-full bg-brand-700 px-1 text-[11px] font-bold text-white shadow ring-2 ring-white" data-testid="cart-count">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function AddedToast({ info, onClose }: { info: AddedInfo | null; onClose: () => void }) {
  const t = useTranslations("shop.cart");
  const locale = useLocale();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:inset-x-auto sm:end-4 sm:top-20 sm:bottom-auto sm:p-0">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-ink-200 transition duration-300",
          info ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
        )}
        data-testid="added-toast"
        hidden={!info}
      >
        {info ? (
          <>
            <div className="flex items-start gap-3">
              {info.imageId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/v1/images/${info.imageId}`} alt="" className="size-14 shrink-0 rounded-lg bg-ink-50 object-contain ring-1 ring-ink-200" />
              ) : (
                <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-brand-50 text-xl">🛒</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                  <span className="grid size-5 place-items-center rounded-full bg-green-600 text-xs text-white">✓</span> {t("addedTitle")}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm font-medium text-ink-900">{info.name}</p>
                <p className="num text-xs text-ink-500">{info.qty} × {info.unitName}</p>
              </div>
              <button type="button" onClick={onClose} className="-m-1 rounded-full p-1 text-ink-400 hover:text-ink-700" aria-label="×">✕</button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-3 text-sm">
              <span className="text-ink-600">
                {t("inCart", { count: info.count })} · <span className="num font-semibold text-ink-900" dir={locale === "ar" ? "ltr" : undefined}>{formatMoney(info.cartTotal)}</span>
              </span>
              <Link href="/cart" onClick={onClose} className="rounded-lg bg-brand-700 px-3 py-1.5 font-semibold text-white hover:bg-brand-800" data-testid="toast-to-cart">
                {t("viewCart")} →
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
