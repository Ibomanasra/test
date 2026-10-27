"use client";

import { formatMoney } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, useApi } from "@/lib/api-client";

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
  lines: { id: string }[];
}

export function CheckoutForm({ options, zones }: { options: Options; zones: { id: string; name: string }[] }) {
  const t = useTranslations("shop.checkout");
  const tr = useTranslations("register");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error, translate } = useApi();
  const [addressId, setAddressId] = useState(options.addresses.find((a) => a.isDefault)?.id ?? options.addresses[0]?.id ?? "");
  const address = options.addresses.find((a) => a.id === addressId);
  const [date, setDate] = useState(address?.deliveryDates[0] ?? "");
  const [method, setMethod] = useState(options.paymentMethods[0]?.method ?? "");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [newAddress, setNewAddress] = useState(options.addresses.length === 0);

  const [previewError, setPreviewError] = useState<string | null>(null);

  // Vorschau neu laden, wenn sich die Adresse ändert (Zustand nur im Callback setzen)
  useEffect(() => {
    if (!addressId) return;
    let cancelled = false;
    apiFetch<Preview>("/api/v1/checkout/preview", { body: { addressId }, locale })
      .then((p) => {
        if (!cancelled) {
          setPreview(p);
          setPreviewError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setPreviewError(translate(e));
      });
    return () => {
      cancelled = true;
    };
  }, [addressId, locale, translate]);

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
    const res = await call<{ id: string }>("/api/v1/orders", { body: { addressId, paymentMethod: method, requestedDeliveryDate: date, customerNote: note || undefined } });
    if (res) router.replace(`/account/orders/${res.id}?placed=1`);
  }

  const onAccount = method === "ON_ACCOUNT";
  const creditShort = onAccount && options.credit && preview ? preview.gross > options.credit.available : false;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title={t("address")}>
          <div className="space-y-2">
            {options.addresses.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-ink-200 has-[:checked]:bg-brand-50 has-[:checked]:ring-brand-600">
                <input type="radio" name="address" checked={addressId === a.id} onChange={() => chooseAddress(a.id)} className="mt-1 accent-brand-700" />
                <span className="text-sm">
                  <span className="font-medium">{a.recipient}</span> – {locale === "ar" ? a.zone.nameAr : a.zone.nameEn}, {a.city}
                  <br />
                  <span className="text-ink-600">{[a.street, a.details].filter(Boolean).join("، ")}</span>
                </span>
              </label>
            ))}
          </div>
          {newAddress ? (
            <form method="post" onSubmit={addAddress} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={tr("zone")} htmlFor="na-zone">
                <Select id="na-zone" name="zoneId" required defaultValue="">
                  <option value="" disabled>{tr("chooseZone")}</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("recipient")} htmlFor="na-rec"><Input id="na-rec" name="recipient" required minLength={2} /></Field>
              <Field label={tc("phone")} htmlFor="na-phone"><Input id="na-phone" name="phone" type="tel" dir="ltr" className="num" required /></Field>
              <Field label={tr("city")} htmlFor="na-city"><Input id="na-city" name="city" required minLength={2} /></Field>
              <Field label={tr("street")} htmlFor="na-street"><Input id="na-street" name="street" /></Field>
              <Field label={tr("details")} htmlFor="na-details"><Input id="na-details" name="details" /></Field>
              <div className="sm:col-span-2"><Button type="submit" variant="secondary" disabled={pending}>{t("saveAddress")}</Button></div>
            </form>
          ) : (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setNewAddress(true)}>{t("newAddress")}</Button>
          )}
        </Card>

        <Card title={t("deliveryDay")}>
          <div className="flex flex-wrap gap-2">
            {(address?.deliveryDates ?? []).map((d) => (
              <label key={d} className="cursor-pointer rounded-lg px-3 py-2 text-sm ring-1 ring-ink-200 has-[:checked]:bg-brand-50 has-[:checked]:ring-brand-600">
                <input type="radio" name="date" value={d} checked={date === d} onChange={() => setDate(d)} className="sr-only" />
                <span>{new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card title={t("payment")}>
          <div className="space-y-2">
            {options.paymentMethods.map((m) => (
              <label key={m.method} className="flex cursor-pointer items-center gap-3 rounded-lg p-3 ring-1 ring-ink-200 has-[:checked]:bg-brand-50 has-[:checked]:ring-brand-600">
                <input type="radio" name="pm" checked={method === m.method} onChange={() => setMethod(m.method)} className="accent-brand-700" data-testid={`pm-${m.method}`} />
                <span>{locale === "ar" ? m.labelAr : m.labelEn}</span>
              </label>
            ))}
          </div>
          {onAccount && options.credit ? (
            <p className="mt-3 text-sm text-ink-600">{t("creditAvailable")}: <span className="num font-medium">{formatMoney(options.credit.available)}</span></p>
          ) : null}
          {method === "BANK_TRANSFER" ? <p className="mt-3 text-sm text-ink-600">{t("bankTransferNote")}</p> : null}
        </Card>

        <Card title={t("note")}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Card>
      </div>

      <div>
        <Card title={t("summary")}>
          {preview ? (
            <div className="space-y-1 text-sm">
              <p className="flex justify-between"><span>{options.channel === "B2B" ? t("goodsNet") : t("goodsGross")}</span><span className="num">{formatMoney(preview.goodsValue)}</span></p>
              <p className="flex justify-between"><span>{t("deliveryFee")}</span><span className="num">{preview.freeDelivery ? t("free") : formatMoney(preview.deliveryFeeGross)}</span></p>
              <p className="flex justify-between text-ink-500"><span>{t("net")}</span><span className="num">{formatMoney(preview.net)}</span></p>
              <p className="flex justify-between text-ink-500"><span>{t("vat")}</span><span className="num">{formatMoney(preview.vat)}</span></p>
              <p className="flex justify-between border-t border-ink-200 pt-2 text-base font-bold"><span>{t("total")}</span><span className="num" data-testid="checkout-total">{formatMoney(preview.gross)}</span></p>
              {preview.belowMinimum ? <Alert tone="amber">{t("belowMinimum", { amount: formatMoney(preview.minimumOrder) })}</Alert> : null}
              {creditShort ? <Alert tone="red">{t("creditShort")}</Alert> : null}
            </div>
          ) : (
            <p className="text-sm text-ink-500">{tc("loading")}</p>
          )}
          {error ?? previewError ? <div className="mt-3"><Alert tone="red">{error ?? previewError}</Alert></div> : null}
          <Button
            className="mt-4 w-full"
            disabled={pending || !preview || preview.belowMinimum || preview.hasProblems || preview.lines.length === 0 || !date || !method || creditShort}
            onClick={() => void place()}
            data-testid="place-order"
          >
            {t("placeOrder")}
          </Button>
        </Card>
      </div>
    </div>
  );
}
