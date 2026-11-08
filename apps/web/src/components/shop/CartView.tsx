"use client";

import { formatMoney } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Input, cn } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { useCart } from "./CartContext";
import type { PricedCart } from "@/server/services/cart";

export interface CartOfferHint {
  /** schon wirksamer Rabatt (Vorschau) */
  current: { nameAr: string; nameEn: string; amount: number } | null;
  /** nächste Stufe „ab Bestellwert“ */
  next: { missing: number; target: number; percentBps: number | null; amountAgorot: number | null } | null;
}

/** Warenkorb: Fotos, −/+ Menge, feste Zusammenfassung, Hinweis auf nächsten Rabatt */
export function CartView({ cart, loggedIn, isB2B, offer }: { cart: PricedCart; loggedIn: boolean; isB2B: boolean; offer: CartOfferHint }) {
  const t = useTranslations("shop.cart");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const cartState = useCart();
  const [listName, setListName] = useState("");
  const [saved, setSaved] = useState(false);
  const nm = (a: string | null, e: string | null) => (locale === "ar" ? a : e);

  async function setQty(id: string, qty: number) {
    setBusyLine(id);
    const res = await call<{ count: number }>(`/api/v1/cart/items/${id}`, { method: "PATCH", body: { qty: Math.max(0, qty) } });
    if (res) {
      cartState.setCount(res.count);
      router.refresh();
    }
    setBusyLine(null);
  }
  async function saveList() {
    if (await call("/api/v1/lists", { body: { name: listName } })) {
      setSaved(true);
      setListName("");
    }
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ink-200" data-testid="cart-empty">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-ink-100 text-3xl">🛒</div>
        <p className="mt-4 text-lg font-semibold text-ink-900">{t("empty")}</p>
        <p className="mt-1 text-sm text-ink-500">{t("emptyText")}</p>
        <Link href="/products" className="mt-6 inline-block rounded-xl bg-ink-900 px-6 py-3 font-semibold text-white hover:bg-ink-800">{t("continue")}</Link>
      </div>
    );
  }

  const progress = offer.next ? Math.min(100, Math.round(((offer.next.target - offer.next.missing) / offer.next.target) * 100)) : 0;
  const benefit = offer.next ? (offer.next.percentBps ? `${offer.next.percentBps / 100}%` : formatMoney(offer.next.amountAgorot ?? 0)) : "";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-3 lg:col-span-2">
        {cart.quoteId ? <Alert tone="blue">{t("quoteApplied")}</Alert> : null}
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-200">
          {cart.lines.map((l) => {
            const busy = busyLine === l.id;
            return (
              <li key={l.id} data-testid="cart-line" className={cn("flex gap-4 p-4", l.problem && "bg-amber-50", busy && "opacity-60")}>
                <Link href={`/products/${l.productSlug}`} className="shrink-0">
                  {l.imageId ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Produktfoto
                    <img src={`/api/v1/images/${l.imageId}`} alt="" className="size-20 rounded-xl bg-ink-50 object-contain ring-1 ring-ink-200 sm:size-24" />
                  ) : (
                    <span className="grid size-20 place-items-center rounded-xl bg-ink-100 text-2xl font-bold text-ink-400 sm:size-24">{(nm(l.nameAr, l.nameEn) ?? "").slice(0, 2)}</span>
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/products/${l.productSlug}`} className="line-clamp-2 font-semibold text-ink-900 hover:underline">
                        {nm(l.nameAr, l.nameEn)}
                        {nm(l.variantNameAr, l.variantNameEn) ? <span className="font-normal text-ink-600"> – {nm(l.variantNameAr, l.variantNameEn)}</span> : null}
                      </Link>
                      <p className="text-xs text-ink-500">
                        <span className="num">{formatMoney(l.unitPrice * l.factor)}</span> / {locale === "ar" ? l.unitNameAr : l.unitNameEn}
                        {l.factor > 1 ? ` (${l.factor})` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => void setQty(l.id, 0)} disabled={pending} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={tc("delete")} data-testid="cart-remove">✕</button>
                  </div>
                  {l.freeQtyBase > 0 ? <p className="mt-1 text-xs font-medium text-green-700">🎁 {t("freeUnits", { count: l.freeQtyBase })}</p> : null}
                  {l.problem ? <p className="mt-1 text-xs text-amber-800">{t(`problems.${l.problem}`, { min: l.minQtyBase, step: l.qtyStepBase, available: Math.max(0, l.availableBase) })}</p> : null}
                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <div className="inline-flex items-center rounded-xl ring-1 ring-ink-300" dir="ltr">
                      <button type="button" className="grid size-9 place-items-center text-lg hover:bg-ink-50 disabled:text-ink-300" disabled={pending || l.qty <= 1} onClick={() => void setQty(l.id, l.qty - 1)} aria-label="−" data-testid="qty-minus">−</button>
                      <Input
                        key={l.qty}
                        type="number"
                        min={1}
                        className="num h-9 w-14 rounded-none border-0 p-0 text-center ring-0 focus:ring-0"
                        defaultValue={l.qty}
                        aria-label={t("qty")}
                        onBlur={(e) => Number(e.target.value) !== l.qty && void setQty(l.id, Number(e.target.value))}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      />
                      <button type="button" className="grid size-9 place-items-center text-lg hover:bg-ink-50" disabled={pending} onClick={() => void setQty(l.id, l.qty + 1)} aria-label="+" data-testid="qty-plus">+</button>
                    </div>
                    <p className="num text-lg font-bold text-ink-900">{formatMoney(l.lineTotal)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {error ? <Alert tone="red">{error}</Alert> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/products" className="text-sm font-medium text-brand-700 hover:underline">← {t("continue")}</Link>
          {isB2B ? (
            <form method="post" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void saveList(); }}>
              <Input value={listName} onChange={(e) => setListName(e.target.value)} placeholder={t("listName")} required minLength={2} className="w-44" />
              <Button type="submit" variant="secondary" disabled={pending}>{t("saveAsList")}</Button>
              {saved ? <span className="self-center text-sm text-green-700">{t("listSaved")}</span> : null}
            </form>
          ) : null}
        </div>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card title={t("summary")}>
          {offer.next ? (
            <div className="mb-4 rounded-xl bg-sky-50 p-3" data-testid="cart-next-offer">
              <p className="text-sm font-medium text-sky-900">{t("nextOffer", { missing: formatMoney(offer.next.missing), benefit })}</p>
              <div className="mt-2 h-2 rounded-full bg-sky-100"><div className="h-2 rounded-full bg-sky-600 transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
          ) : null}
          <div className="space-y-2 text-sm">
            <p className="flex justify-between"><span className="text-ink-600">{t("items", { count: cart.count })}</span><span className="num">{formatMoney(cart.goodsValue)}</span></p>
            {offer.current ? (
              <p className="flex justify-between font-medium text-green-700"><span>🎁 {nm(offer.current.nameAr, offer.current.nameEn)}</span><span className="num">−{formatMoney(offer.current.amount)}</span></p>
            ) : null}
            <p className="flex justify-between text-ink-500"><span>{t("delivery")}</span><span>{t("deliveryLater")}</span></p>
            <p className="flex justify-between border-t border-ink-200 pt-3 text-lg font-bold"><span>{t("estimated")}</span><span className="num">{formatMoney(Math.max(0, (cart.channel === "B2B" ? cart.goodsValue : cart.gross) - (offer.current?.amount ?? 0)))}</span></p>
            {cart.vat ? <p className="text-xs text-ink-500">{cart.channel === "B2B" ? t("plusVat") : t("vatIncluded")}</p> : null}
          </div>
          <div className="mt-5">
            {cart.hasProblems ? (
              <Alert tone="amber">{t("fixProblems")}</Alert>
            ) : loggedIn ? (
              <Button className="w-full py-3 text-base" onClick={() => router.push("/checkout")} data-testid="to-checkout">{t("checkout")} →</Button>
            ) : (
              <div className="space-y-2" data-testid="guest-checkout">
                {/* ohne Konto bestellen (Hauptweg) – Konto ist optional */}
                <Button className="w-full py-3 text-base" onClick={() => router.push("/checkout")} data-testid="to-checkout">{t("checkout")} →</Button>
                <p className="text-center text-xs text-ink-500">{t("guestNoAccount")}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1 py-2" onClick={() => router.push("/register?next=/checkout")} data-testid="cart-register">✨ {t("guestRegister")}</Button>
                  <Button variant="ghost" className="flex-1 py-2" onClick={() => router.push("/login?next=/checkout")} data-testid="cart-login">{t("guestLogin")}</Button>
                </div>
              </div>
            )}
          </div>
          <ul className="mt-4 space-y-1 text-xs text-ink-500">
            <li>✓ {t("trust1")}</li>
            <li>✓ {t("trust2")}</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
