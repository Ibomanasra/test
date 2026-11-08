"use client";

import { formatMoney } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { CityZoneFields } from "@/components/shared/CityZoneFields";
import { useEffect, useState } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { apiFetch, useApi } from "@/lib/api-client";
import { useCart } from "./CartContext";

interface Options {
  channel: "B2C" | "B2B";
  addresses: {
    id: string;
    label: string | null;
    recipient: string;
    city: string;
    street: string | null;
    details: string | null;
    isDefault: boolean;
    zone: { nameAr: string; nameEn: string };
    deliveryDates: string[];
  }[];
  paymentMethods: { method: string; labelAr: string; labelEn: string }[];
  credit: { limit: number; openBalance: number; openOrders: number; available: number } | null;
}

interface Preview {
  goodsValue: number;
  deliveryFeeGross: number;
  freeDelivery: boolean;
  minimumOrder: number;
  belowMinimum: boolean;
  net: number;
  vat: number;
  gross: number;
  hasProblems: boolean;
  lines: { id: string; imageId: string | null; nameAr: string; nameEn: string; qty: number; unitNameAr: string; unitNameEn: string; factor: number; lineTotal: number }[];
  offer: { nameAr: string; nameEn: string; kind: string; discount: number } | null;
  freeDeliveryOffer: { nameAr: string; nameEn: string; saved: number } | null;
  coupon: { status: "applied" | "not_better" | "invalid"; reason: string | null } | null;
  nextOffer: { nameAr: string; nameEn: string; missing: number; percentBps: number | null; amountAgorot: number | null } | null;
  /** nur Gäste: Liefertage der aus dem Ort ermittelten Zone */
  deliveryDates?: string[];
}

const EMPTY_GUEST = { name: "", phone: "", city: "", zoneId: "", street: "", details: "" };

export function CheckoutForm({ options, zones, guest = false }: { options: Options; zones: { id: string; name: string }[]; guest?: boolean }) {
  const t = useTranslations("shop.checkout");
  const tr = useTranslations("register");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const cart = useCart();
  const { call, pending, error, translate } = useApi();
  const [addressId, setAddressId] = useState(options.addresses.find((a) => a.isDefault)?.id ?? options.addresses[0]?.id ?? "");
  const address = options.addresses.find((a) => a.id === addressId);
  const [date, setDate] = useState(address?.deliveryDates[0] ?? "");
  const [method, setMethod] = useState(options.paymentMethods[0]?.method ?? "");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [newAddress, setNewAddress] = useState(options.addresses.length === 0);

  const [previewError, setPreviewError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  // Gast: Name, Telefon, Adresse (wie bei Kunden), Vorschau nach dem Ort
  const [g, setG] = useState(EMPTY_GUEST);
  const [debouncedCity, setDebouncedCity] = useState({ city: "", zoneId: "" });
  useEffect(() => {
    if (!guest) return;
    const timer = setTimeout(() => setDebouncedCity({ city: g.city.trim(), zoneId: g.zoneId }), 450);
    return () => clearTimeout(timer);
  }, [guest, g.city, g.zoneId]);
  const [coupon, setCoupon] = useState<string | undefined>(undefined);
  const nm = (o: { nameAr: string; nameEn: string }) => (locale === "ar" ? o.nameAr : o.nameEn);

  // Vorschau neu laden, wenn sich die Adresse (Gast: der Ort) ändert (Zustand nur im Callback setzen)
  useEffect(() => {
    if (guest ? debouncedCity.city.length < 2 : !addressId) return;
    let cancelled = false;
    const req = guest
      ? apiFetch<Preview>("/api/v1/checkout/guest", { body: { city: debouncedCity.city, zoneId: debouncedCity.zoneId || undefined, couponCode: coupon }, locale })
      : apiFetch<Preview>("/api/v1/checkout/preview", { body: { addressId, couponCode: coupon }, locale });
    req
      .then((p) => {
        if (!cancelled) {
          setPreview(p);
          setPreviewError(null);
          if (guest && p.deliveryDates) setDate((d) => (d && p.deliveryDates!.includes(d) ? d : (p.deliveryDates![0] ?? "")));
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setPreviewError(translate(e));
      });
    return () => {
      cancelled = true;
    };
  }, [guest, debouncedCity, addressId, coupon, locale, translate]);

  function chooseAddress(id: string) {
    setAddressId(id);
    setDate(options.addresses.find((a) => a.id === id)?.deliveryDates[0] ?? "");
  }

  async function addAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const a = await call<{ id: string }>("/api/v1/addresses", {
      body: { zoneId: s("zoneId"), recipient: s("recipient"), phone: s("phone"), city: s("city"), street: s("street") || undefined, details: s("details") || undefined, isDefault: options.addresses.length === 0 },
    });
    if (a) {
      router.refresh();
      setNewAddress(false);
    }
  }

  async function place() {
    if (guest) {
      const r = await call<{ id: string; token: string }>("/api/v1/orders/guest", {
        body: { name: g.name, phone: g.phone, city: g.city, zoneId: g.zoneId || undefined, street: g.street || undefined, details: g.details || undefined, paymentMethod: method, requestedDeliveryDate: date, customerNote: note || undefined, couponCode: coupon, locale },
      });
      if (!r) return;
      cart.setCount(0);
      router.replace(`/order/${r.id}?k=${r.token}`);
      return;
    }
    const res = await call<{ id: string }>("/api/v1/orders", { body: { addressId, paymentMethod: method, requestedDeliveryDate: date, customerNote: note || undefined, couponCode: coupon } });
    if (!res) return;
    // Bestellung angelegt → Korb ist leer: Zähler sofort auf 0
    cart.setCount(0);
    if (method === "CARD_GATEWAY") {
      // Kartenzahlung: weiter zur gehosteten Bezahlseite des Gateways
      const pay = await call<{ redirectUrl: string }>(`/api/v1/orders/${res.id}/pay`, { body: {} });
      if (pay) {
        window.location.assign(pay.redirectUrl);
        return;
      }
    }
    router.replace(`/account/orders/${res.id}?placed=1`);
  }

  const onAccount = method === "ON_ACCOUNT";
  const creditShort = onAccount && options.credit && preview ? preview.gross > options.credit.available : false;
  const fmtDay = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-GB", { ...o, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const PM_ICON: Record<string, string> = { CASH_ON_DELIVERY: "💵", BANK_TRANSFER: "🏦", CARD_GATEWAY: "💳", ON_ACCOUNT: "🧾" };
  const guestReady = !guest || (g.name.trim().length >= 2 && g.phone.trim().length >= 6 && g.city.trim().length >= 2);
  const canPlace = !pending && guestReady && !!preview && !preview.belowMinimum && !preview.hasProblems && preview.lines.length > 0 && !!date && !!method && !creditShort;
  const dates = guest ? (preview?.deliveryDates ?? []) : (address?.deliveryDates ?? []);
  const section = (n: number, title: string, children: React.ReactNode, testId?: string) => (
    <section className="min-w-0 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-200" data-testid={testId}>
      <h2 className="mb-4 flex items-center gap-3 text-base font-bold text-ink-900">
        <span className="num grid size-7 place-items-center rounded-full bg-ink-900 text-sm text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );

  return (
    <div className="grid grid-cols-1 gap-6 pb-24 lg:grid-cols-3 lg:pb-0">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        {guest ? (
          <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900" data-testid="guest-hint">
            {t("guest.hint")} <Link href="/login?next=/checkout" className="font-semibold underline">{t("guest.login")}</Link>
          </p>
        ) : null}
        {guest ? section(
          1,
          t("guest.title"),
          <div
            className="grid gap-3 sm:grid-cols-2"
            onChange={(e) => {
              const el = e.target as HTMLInputElement;
              if (el.name && el.name in EMPTY_GUEST) setG((x) => ({ ...x, [el.name]: el.value }));
            }}
          >
            <Field label={t("guest.name")} htmlFor="g-name"><Input id="g-name" name="name" required minLength={2} autoComplete="name" data-testid="guest-name" /></Field>
            <Field label={tc("phone")} htmlFor="g-phone" hint={t("guest.phoneHint")}><Input id="g-phone" name="phone" type="tel" inputMode="tel" dir="ltr" className="num" required autoComplete="tel" placeholder="059xxxxxxx" data-testid="guest-phone" /></Field>
            <CityZoneFields zones={zones} idPrefix="g-" />
            <Field label={tr("street")} htmlFor="g-street"><Input id="g-street" name="street" autoComplete="address-line1" /></Field>
            <Field label={tr("details")} htmlFor="g-details"><Input id="g-details" name="details" /></Field>
          </div>,
          "co-guest",
        ) : section(
          1,
          t("address"),
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.addresses.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-ink-200 transition has-[:checked]:bg-brand-50 has-[:checked]:ring-2 has-[:checked]:ring-brand-600">
                  <input type="radio" name="address" checked={addressId === a.id} onChange={() => chooseAddress(a.id)} className="mt-1 accent-brand-700" />
                  <span className="text-sm">
                    <span className="font-semibold text-ink-900">{a.city}</span> <span className="text-ink-500">· {locale === "ar" ? a.zone.nameAr : a.zone.nameEn}</span>
                    <br />
                    <span className="text-ink-600">{[a.street, a.details].filter(Boolean).join("، ") || a.recipient}</span>
                  </span>
                </label>
              ))}
            </div>
            {newAddress ? (
              <form method="post" onSubmit={addAddress} className="mt-4 grid gap-3 rounded-xl bg-ink-50 p-4 sm:grid-cols-2">
                <Field label={t("recipient")} htmlFor="na-rec"><Input id="na-rec" name="recipient" required minLength={2} /></Field>
                <Field label={tc("phone")} htmlFor="na-phone"><Input id="na-phone" name="phone" type="tel" dir="ltr" className="num" required /></Field>
                <CityZoneFields zones={zones} idPrefix="na-" />
                <Field label={tr("street")} htmlFor="na-street"><Input id="na-street" name="street" /></Field>
                <Field label={tr("details")} htmlFor="na-details"><Input id="na-details" name="details" /></Field>
                <div className="sm:col-span-2"><Button type="submit" variant="secondary" disabled={pending}>{t("saveAddress")}</Button></div>
              </form>
            ) : (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setNewAddress(true)}>＋ {t("newAddress")}</Button>
            )}
          </>,
          "co-address",
        )}

        {section(
          2,
          t("deliveryDay"),
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dates.length === 0 && guest ? <p className="text-sm text-ink-500">{t("guest.cityFirst")}</p> : null}
            {dates.map((d, i) => (
              <label key={d} className="relative shrink-0 cursor-pointer rounded-xl px-4 py-3 text-center text-sm ring-1 ring-ink-200 transition has-[:checked]:bg-ink-900 has-[:checked]:text-white has-[:checked]:ring-ink-900">
                <input type="radio" name="date" value={d} checked={date === d} onChange={() => setDate(d)} className="sr-only" />
                <span className="block font-semibold">{i === 0 ? t("soonest") : fmtDay(d, { weekday: "long" })}</span>
                <span className="block text-xs opacity-80">{i === 0 ? fmtDay(d, { weekday: "short", day: "numeric", month: "short" }) : fmtDay(d, { day: "numeric", month: "short" })}</span>
              </label>
            ))}
          </div>,
          "co-date",
        )}

        {section(
          3,
          t("payment"),
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.paymentMethods.map((m) => (
                <label key={m.method} className="relative flex cursor-pointer items-center gap-3 rounded-xl p-4 ring-1 ring-ink-200 transition has-[:checked]:bg-brand-50 has-[:checked]:ring-2 has-[:checked]:ring-brand-600">
                  <input type="radio" name="pm" checked={method === m.method} onChange={() => setMethod(m.method)} className="size-4 shrink-0 accent-brand-700" data-testid={`pm-${m.method}`} />
                  <span className="text-2xl" aria-hidden="true">{PM_ICON[m.method] ?? "•"}</span>
                  <span className="font-medium text-ink-900">{locale === "ar" ? m.labelAr : m.labelEn}</span>
                </label>
              ))}
            </div>
            {onAccount && options.credit ? <p className="mt-3 text-sm text-ink-600">{t("creditAvailable")}: <span className="num font-medium">{formatMoney(options.credit.available)}</span></p> : null}
            {method === "BANK_TRANSFER" ? <p className="mt-3 text-sm text-ink-600">{t("bankTransferNote")}</p> : null}
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-ink-600">{t("note")}</summary>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className="mt-2" />
            </details>
          </>,
          "co-payment",
        )}
      </div>

      {/* Zusammenfassung */}
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-200">
          <h2 className="mb-3 text-base font-bold text-ink-900">{t("summary")}</h2>
          {preview ? (
            <div className="space-y-2 text-sm">
              <ul className="mb-3 max-h-56 space-y-2 overflow-y-auto">
                {preview.lines.map((l) => (
                  <li key={l.id} className="flex items-center gap-3">
                    {l.imageId ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Produktfoto
                      <img src={`/api/v1/images/${l.imageId}`} alt="" className="size-11 rounded-lg bg-ink-50 object-contain ring-1 ring-ink-200" />
                    ) : (
                      <span className="grid size-11 place-items-center rounded-lg bg-ink-100 text-xs text-ink-400">{(locale === "ar" ? l.nameAr : l.nameEn).slice(0, 2)}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-ink-900">{locale === "ar" ? l.nameAr : l.nameEn}</span>
                      <span className="num text-xs text-ink-500">{l.qty} × {locale === "ar" ? l.unitNameAr : l.unitNameEn}</span>
                    </span>
                    <span className="num font-medium">{formatMoney(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              {preview.nextOffer ? (
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-sky-900" data-testid="next-offer">
                  {t("offers.next", { missing: formatMoney(preview.nextOffer.missing), benefit: preview.nextOffer.percentBps ? `${preview.nextOffer.percentBps / 100}%` : formatMoney(preview.nextOffer.amountAgorot ?? 0) })}
                </p>
              ) : null}
              <div className="space-y-1.5 border-t border-ink-100 pt-3">
                <p className="flex justify-between"><span className="text-ink-600">{options.channel === "B2B" ? t("goodsNet") : t("goodsGross")}</span><span className="num">{formatMoney(preview.goodsValue + (preview.offer?.discount ?? 0))}</span></p>
                {preview.offer ? (
                  <p className="flex justify-between font-medium text-green-700" data-testid="offer-discount"><span>🎁 {nm(preview.offer)}</span><span className="num">−{formatMoney(preview.offer.discount)}</span></p>
                ) : null}
                <p className="flex justify-between"><span className="text-ink-600">{t("deliveryFee")}</span><span className={preview.freeDelivery ? "num font-medium text-green-700" : "num"}>{preview.freeDelivery ? (preview.freeDeliveryOffer ? `${t("free")} · ${nm(preview.freeDeliveryOffer)}` : t("free")) : formatMoney(preview.deliveryFeeGross)}</span></p>
                {preview.vat ? (
                  <>
                    <p className="flex justify-between text-ink-500"><span>{t("net")}</span><span className="num">{formatMoney(preview.net)}</span></p>
                    <p className="flex justify-between text-ink-500"><span>{t("vat")}</span><span className="num">{formatMoney(preview.vat)}</span></p>
                  </>
                ) : null}
                <p className="flex justify-between border-t border-ink-200 pt-3 text-xl font-extrabold"><span>{t("total")}</span><span className="num" data-testid="checkout-total">{formatMoney(preview.gross)}</span></p>
              </div>
              {preview.belowMinimum ? <Alert tone="amber">{t("belowMinimum", { amount: formatMoney(preview.minimumOrder) })}</Alert> : null}
              {creditShort ? <Alert tone="red">{t("creditShort")}</Alert> : null}
              {/* Gutschein */}
              <form
                className="flex gap-2 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setCoupon(couponInput.trim() || undefined);
                }}
              >
                <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder={t("offers.couponPlaceholder")} dir="ltr" className={couponInput ? "font-mono uppercase" : ""} aria-label={t("offers.coupon")} data-testid="coupon-input" />
                <Button type="submit" variant="secondary" size="sm" data-testid="coupon-apply">{t("offers.apply")}</Button>
              </form>
              {preview.coupon ? (
                <p className={preview.coupon.status === "applied" ? "text-green-700" : "text-amber-800"} data-testid="coupon-status">
                  {preview.coupon.status === "applied" ? t("offers.couponApplied") : preview.coupon.status === "not_better" ? t("offers.couponNotBetter") : t(`offers.couponInvalid.${preview.coupon.reason === "min_order" || preview.coupon.reason === "ended" || preview.coupon.reason === "used_up" || preview.coupon.reason === "customer_limit" ? preview.coupon.reason : "default"}`)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink-500">{guest && debouncedCity.city.length < 2 ? t("guest.cityFirst") : tc("loading")}</p>
          )}
          {error ?? previewError ? <div className="mt-3"><Alert tone="red">{error ?? previewError}</Alert></div> : null}
          <Button className="mt-4 hidden w-full py-3 text-base lg:block" disabled={!canPlace} onClick={() => void place()} data-testid="place-order">
            {t("placeOrder")}
          </Button>
          <p className="mt-3 text-center text-xs text-ink-500">🔒 {t("secure")}</p>
        </section>
      </div>

      {/* Handy: feste Leiste mit Summe und Bestellknopf */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-ink-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
        <div className="flex-1">
          <p className="text-xs text-ink-500">{t("total")}</p>
          <p className="num text-lg font-extrabold">{preview ? formatMoney(preview.gross) : "…"}</p>
        </div>
        <Button className="px-6 py-3 text-base" disabled={!canPlace} onClick={() => void place()} data-testid="place-order-mobile">{t("placeOrder")}</Button>
      </div>
    </div>
  );
}
