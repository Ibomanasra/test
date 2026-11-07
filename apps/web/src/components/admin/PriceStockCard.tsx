"use client";

import { formatMoney, parseShekel } from "@sa/core";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { ApiError, apiFetch } from "@/lib/api-client";

export interface PriceStockVariant {
  id: string;
  sku: string;
  label: string | null;
  b2cPrice: number;
  b2bBasePrice: number;
  costPrice: number | null;
  available: number;
  reserved: number;
  cartonFactor: number | null;
}

const toInput = (a: number) => formatMoney(a, { symbol: false, grouping: false });

/** Preis und Bestand direkt am Produkt – je Variante eine Zeile */
export function PriceStockCard({ variants, canPrice, canStock, canSeeCost, canConfirmBelow }: { variants: PriceStockVariant[]; canPrice: boolean; canStock: boolean; canSeeCost: boolean; canConfirmBelow: boolean }) {
  const t = useTranslations("admin.products.manage");
  return (
    <Card title={t("priceStock")}>
      <div className="space-y-5">
        {variants.map((v) => (
          <VariantRow key={v.id} v={v} canPrice={canPrice} canStock={canStock} canSeeCost={canSeeCost} canConfirmBelow={canConfirmBelow} multi={variants.length > 1} />
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-500">{t("priceStockHint")}</p>
    </Card>
  );
}

function VariantRow({ v, canPrice, canStock, canSeeCost, canConfirmBelow, multi }: { v: PriceStockVariant; canPrice: boolean; canStock: boolean; canSeeCost: boolean; canConfirmBelow: boolean; multi: boolean }) {
  const t = useTranslations("admin.products.manage");
  const te = useTranslations("errors");
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function savePrices(e: React.FormEvent<HTMLFormElement>, confirm = false): Promise<void> {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let body: Record<string, unknown>;
    try {
      body = {
        b2cPrice: parseShekel(String(fd.get("b2c"))),
        b2bBasePrice: parseShekel(String(fd.get("b2b"))),
        ...(canSeeCost && fd.get("cost") ? { costPrice: parseShekel(String(fd.get("cost"))) } : {}),
        confirmBelowMargin: confirm,
      };
    } catch {
      return setMsg({ tone: "red", text: te("invalid_amount") });
    }
    setBusy(true);
    try {
      await apiFetch(`/api/v1/admin/prices/variants/${v.id}`, { method: "PUT", body });
      setMsg({ tone: "green", text: t("saved") });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.body.code === "below_margin" && canConfirmBelow && window.confirm(t("belowMargin"))) {
        setBusy(false);
        const form = e.currentTarget;
        return savePrices({ preventDefault() {}, currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>, true);
      }
      const code = err instanceof ApiError ? err.body.code : "generic";
      setMsg({ tone: "red", text: te.has(code) ? te(code) : te("generic") });
    } finally {
      setBusy(false);
    }
  }

  async function adjust(sign: 1 | -1, form: HTMLFormElement) {
    const qty = Number.parseInt(String(new FormData(form).get("qty") ?? ""), 10);
    if (!qty || qty < 0) return setMsg({ tone: "red", text: te("validation_error") });
    setBusy(true);
    try {
      await apiFetch("/api/v1/admin/stock/adjust", { body: { sku: v.sku, qtyBase: sign * qty, reason: sign > 0 ? "إضافة مخزون / stock added" : "خصم مخزون / stock removed" } });
      form.reset();
      setMsg({ tone: "green", text: t("stockSaved") });
      router.refresh();
    } catch (err) {
      const code = err instanceof ApiError ? err.body.code : "generic";
      setMsg({ tone: "red", text: te.has(code) ? te(code) : te("generic") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl ring-1 ring-ink-200" data-testid="price-stock-row">
      {multi ? <p className="border-b border-ink-100 bg-ink-50 px-4 py-2 text-sm font-medium"><span className="num">{v.sku}</span>{v.label ? ` · ${v.label}` : ""}</p> : null}
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <form onSubmit={(e) => void savePrices(e)} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={t("b2c")} htmlFor={`b2c-${v.id}`}><Input id={`b2c-${v.id}`} name="b2c" inputMode="decimal" dir="ltr" className="num font-semibold" defaultValue={toInput(v.b2cPrice)} disabled={!canPrice} /></Field>
          <Field label={t("b2b")} htmlFor={`b2b-${v.id}`}><Input id={`b2b-${v.id}`} name="b2b" inputMode="decimal" dir="ltr" className="num" defaultValue={toInput(v.b2bBasePrice)} disabled={!canPrice} /></Field>
          {canSeeCost ? <Field label={t("cost")} htmlFor={`cost-${v.id}`}><Input id={`cost-${v.id}`} name="cost" inputMode="decimal" dir="ltr" className="num" defaultValue={v.costPrice != null ? toInput(v.costPrice) : ""} disabled={!canPrice} /></Field> : null}
          {canPrice ? <div className="col-span-2 sm:col-span-3"><Button type="submit" size="sm" disabled={busy} data-testid="save-prices">{t("savePrices")}</Button></div> : null}
        </form>
        <form onSubmit={(e) => e.preventDefault()} className="rounded-lg bg-ink-50 p-3">
          <p className="text-sm text-ink-600">{t("available")}</p>
          <p className={`num text-2xl font-bold ${v.available <= 0 ? "text-red-700" : "text-ink-900"}`}>{v.available}</p>
          <p className="text-xs text-ink-500">
            {v.reserved ? t("reservedInfo", { count: v.reserved }) : null}
            {v.cartonFactor ? ` · ${t("cartonInfo", { count: Math.floor(v.available / v.cartonFactor), factor: v.cartonFactor })}` : null}
          </p>
          {canStock ? (
            <div className="mt-3 flex items-center gap-2">
              <Input name="qty" inputMode="numeric" dir="ltr" className="num w-24" placeholder="0" aria-label={t("qty")} data-testid="stock-qty" />
              <Button type="button" size="sm" disabled={busy} onClick={(e) => void adjust(1, e.currentTarget.form!)} data-testid="stock-add">＋ {t("add")}</Button>
              <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={(e) => void adjust(-1, e.currentTarget.form!)}>− {t("remove")}</Button>
            </div>
          ) : null}
        </form>
      </div>
      {msg ? <div className="px-4 pb-3"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}
    </div>
  );
}
