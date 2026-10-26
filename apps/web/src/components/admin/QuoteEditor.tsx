"use client";

import { formatMoney, parseShekel } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { ApiError, apiFetch, useApi } from "@/lib/api-client";

interface Item {
  sku: string;
  unitCode: string;
  qty: string;
  price: string;
}

export interface QuoteEditorProps {
  quoteId?: string;
  customers: { value: string; label: string }[];
  skuOptions: { sku: string; label: string; units: { code: string; factor: number }[] }[];
  unitNames: Record<string, string>;
  initial?: { customerId: string; validUntil: string; isFixed: boolean; internalNote: string; items: Item[] };
  defaultValidUntil: string;
}

export function QuoteEditor({ quoteId, customers, skuOptions, unitNames, initial, defaultValidUntil }: QuoteEditorProps) {
  const t = useTranslations("admin.quotes");
  const tp = useTranslations("admin.prices");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const { run, pending, error, setError } = useApi();
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? defaultValidUntil);
  const [isFixed, setIsFixed] = useState(initial?.isFixed ?? true);
  const [note, setNote] = useState(initial?.internalNote ?? "");
  const [items, setItems] = useState<Item[]>(initial?.items ?? [{ sku: "", unitCode: "CARTON", qty: "1", price: "" }]);
  const [confirm, setConfirm] = useState(false);

  const unitsOf = (sku: string) => skuOptions.find((s) => s.sku === sku)?.units ?? [{ code: "PIECE", factor: 1 }];
  const factorOf = (it: Item) => unitsOf(it.sku).find((u) => u.code === it.unitCode)?.factor ?? 1;

  async function suggest(idx: number, it: Item) {
    if (!customerId || !it.sku) return;
    const qtyBase = Math.max(1, Number(it.qty || 1) * factorOf(it));
    try {
      const r = await apiFetch<{ result: { unitNet: number } }>(`/api/v1/admin/prices/preview?sku=${encodeURIComponent(it.sku)}&customerId=${customerId}&qtyBase=${qtyBase}`, { locale });
      setItems((prev) => prev.map((x, i) => (i === idx && !x.price ? { ...x, price: formatMoney(r.result.unitNet, { symbol: false, grouping: false }) } : x)));
    } catch {
      /* Vorschlag ist optional */
    }
  }

  function update(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  let total = 0;
  for (const it of items) {
    try {
      total += parseShekel(it.price || "0") * Number(it.qty || 0) * factorOf(it);
    } catch {
      /* ungültige Eingabe wird beim Speichern gemeldet */
    }
  }

  async function save(confirmBelowMargin = false) {
    let body;
    try {
      body = {
        ...(quoteId ? {} : { customerId }),
        validUntil,
        isFixed,
        internalNote: note || undefined,
        confirmBelowMargin,
        items: items.filter((i) => i.sku).map((i) => ({ sku: i.sku, unitCode: i.unitCode, qty: Number(i.qty), unitPriceNet: parseShekel(i.price) })),
      };
    } catch {
      return setError(te("invalid_amount"));
    }
    try {
      setError(null);
      const res = await apiFetch<{ id: string }>(quoteId ? `/api/v1/admin/quotes/${quoteId}` : "/api/v1/admin/quotes", { method: quoteId ? "PUT" : "POST", body, locale });
      router.push(`/admin/quotes/${res.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.body.code === "below_margin") return setConfirm(true);
      await run(() => Promise.reject(err));
    }
  }

  return (
    <Card>
      <form
        method="post"
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("customer")} htmlFor="q-cust">
            <Select id="q-cust" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required disabled={!!quoteId}>
              <option value="" disabled>–</option>
              {customers.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("validUntil")} htmlFor="q-valid">
            <Input id="q-valid" type="date" dir="ltr" className="num" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} className="size-4 accent-brand-700" />
            {t("isFixed")}
          </label>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>{tp("sku")}</Th>
              <Th>{t("unit")}</Th>
              <Th>{t("qty")}</Th>
              <Th>{t("unitPriceNet")}</Th>
              <Th>{t("lineNet")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {items.map((it, idx) => {
              let line = "";
              try {
                line = formatMoney(parseShekel(it.price || "0") * Number(it.qty || 0) * factorOf(it));
              } catch {
                line = "–";
              }
              return (
                <tr key={idx}>
                  <Td>
                    <Input list="q-skus" dir="ltr" className="num min-w-32" value={it.sku} onChange={(e) => update(idx, { sku: e.target.value })} onBlur={() => void suggest(idx, it)} required />
                  </Td>
                  <Td>
                    <Select value={it.unitCode} onChange={(e) => update(idx, { unitCode: e.target.value })}>
                      {unitsOf(it.sku).map((u) => (
                        <option key={u.code} value={u.code}>{unitNames[u.code] ?? u.code} ({u.factor})</option>
                      ))}
                    </Select>
                  </Td>
                  <Td><Input type="number" min={1} dir="ltr" className="num w-24" value={it.qty} onChange={(e) => update(idx, { qty: e.target.value })} required /></Td>
                  <Td><Input dir="ltr" className="num w-28" value={it.price} onChange={(e) => update(idx, { price: e.target.value })} required placeholder={t("perPiece")} /></Td>
                  <Td className="num">{line}</Td>
                  <Td><Button type="button" size="sm" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}>✕</Button></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <datalist id="q-skus">
          {skuOptions.map((o) => (
            <option key={o.sku} value={o.sku}>{o.label}</option>
          ))}
        </datalist>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setItems([...items, { sku: "", unitCode: "CARTON", qty: "1", price: "" }])}>{t("addItem")}</Button>
          <p className="text-sm">{t("subtotalNet")}: <span className="num font-semibold">{formatMoney(total)}</span></p>
        </div>
        <Field label={t("internalNote")} htmlFor="q-note">
          <Input id="q-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error ? <Alert tone="red">{error}</Alert> : null}
        {confirm ? (
          <Alert tone="amber">
            <p>{tp("belowMarginText")}</p>
            <Button type="button" className="mt-2" variant="danger" size="sm" onClick={() => void save(true)}>{tp("confirmBelowMargin")}</Button>
          </Alert>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{tc("save")}</Button>
        </div>
      </form>
    </Card>
  );
}
