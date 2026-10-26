"use client";

import { formatBps, formatMoney } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/api-client";

interface Trace {
  rule: string;
  ref?: string;
  unitPrice: number;
  note: string;
  applied: boolean;
}
interface PreviewResponse {
  channel: "B2C" | "B2B";
  customer: { displayName: string } | null;
  minimumNet: number;
  result: {
    unitPrice: number;
    unitNet: number;
    unitGross: number;
    rule: string;
    freeQtyBase: number;
    payableQtyBase: number;
    listUnitPrice: number;
    marginBps: number;
    costPrice: number;
    trace: Trace[];
  };
}

export function PricePreview({ customers, skuOptions, canSeeCost }: { customers: { value: string; label: string }[]; skuOptions: { sku: string; label: string }[]; canSeeCost: boolean }) {
  const t = useTranslations("admin.prices");
  const locale = useLocale();
  const { call, pending, error } = useApi();
  const [q, setQ] = useState({ sku: skuOptions[0]?.sku ?? "", customerId: "", channel: "B2C", qtyBase: "1", date: "" });
  const [res, setRes] = useState<PreviewResponse | null>(null);

  async function calc(e: React.FormEvent) {
    e.preventDefault();
    const qs = new URLSearchParams({ sku: q.sku, qtyBase: q.qtyBase });
    if (q.customerId) qs.set("customerId", q.customerId);
    else qs.set("channel", q.channel);
    if (q.date) qs.set("date", q.date);
    const r = await call<PreviewResponse>(`/api/v1/admin/prices/preview?${qs.toString()}`, { locale });
    if (r) setRes(r);
  }

  const m = (a: number) => <span className="num">{formatMoney(a)}</span>;

  return (
    <div className="space-y-6">
      <Card title={t("previewTitle")}>
        <p className="mb-4 text-sm text-ink-600">{t("previewText")}</p>
        <form method="post" onSubmit={calc} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label={t("sku")} htmlFor="p-sku">
            <Input id="p-sku" list="p-sku-list" dir="ltr" className="num" value={q.sku} onChange={(e) => setQ({ ...q, sku: e.target.value })} required />
            <datalist id="p-sku-list">
              {skuOptions.map((o) => (
                <option key={o.sku} value={o.sku}>{o.label}</option>
              ))}
            </datalist>
          </Field>
          <Field label={t("customer")} htmlFor="p-cust">
            <Select id="p-cust" value={q.customerId} onChange={(e) => setQ({ ...q, customerId: e.target.value })}>
              <option value="">{t("noCustomer")}</option>
              {customers.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("channel")} htmlFor="p-ch">
            <Select id="p-ch" value={q.channel} disabled={!!q.customerId} onChange={(e) => setQ({ ...q, channel: e.target.value })}>
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
            </Select>
          </Field>
          <Field label={t("qtyPieces")} htmlFor="p-qty">
            <Input id="p-qty" type="number" min={1} dir="ltr" className="num" value={q.qtyBase} onChange={(e) => setQ({ ...q, qtyBase: e.target.value })} required />
          </Field>
          <Field label={t("previewDate")} htmlFor="p-date">
            <Input id="p-date" type="date" dir="ltr" className="num" value={q.date} onChange={(e) => setQ({ ...q, date: e.target.value })} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button type="submit" disabled={pending} data-testid="preview-calc">{t("calculate")}</Button>
          </div>
        </form>
      </Card>
      {error ? <Alert tone="red">{error}</Alert> : null}
      {res ? (
        <Card title={t("previewResult")}>
          <div className="mb-4 grid gap-4 sm:grid-cols-4" data-testid="preview-result">
            <div className="rounded-lg bg-brand-50 p-4">
              <p className="text-xs text-ink-600">{res.channel === "B2B" ? t("unitNet") : t("unitGross")}</p>
              <p className="text-2xl font-bold" data-testid="preview-price">{m(res.result.unitPrice)}</p>
              <p className="mt-1 text-xs"><Badge tone="brand">{t(`rules.${res.result.rule}`)}</Badge></p>
            </div>
            <div className="rounded-lg bg-ink-50 p-4 text-sm">
              <p>{t("unitNet")}: {m(res.result.unitNet)}</p>
              <p>{t("unitGross")}: {m(res.result.unitGross)}</p>
              <p>{t("listPrice")}: {m(res.result.listUnitPrice)}</p>
            </div>
            <div className="rounded-lg bg-ink-50 p-4 text-sm">
              <p>{t("payableQty")}: <span className="num">{res.result.payableQtyBase}</span></p>
              <p>{t("freeQty")}: <span className="num">{res.result.freeQtyBase}</span></p>
              <p>{t("lineTotal")}: {m(res.result.unitPrice * res.result.payableQtyBase)}</p>
            </div>
            {canSeeCost ? (
              <div className={`rounded-lg p-4 text-sm ${res.result.unitNet < res.minimumNet ? "bg-amber-50" : "bg-ink-50"}`}>
                <p>{t("cost")}: {m(res.result.costPrice)}</p>
                <p>{t("margin")}: <span className="num">{formatBps(res.result.marginBps)}</span></p>
                <p>{t("minimumNet")}: {m(res.minimumNet)}</p>
              </div>
            ) : null}
          </div>
          <h3 className="mb-2 font-semibold">{t("trace")}</h3>
          <Table>
            <thead>
              <tr>
                <Th>{t("rule")}</Th>
                <Th>{t("unitPrice")}</Th>
                <Th>{t("detail")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {res.result.trace.map((tr, i) => (
                <tr key={i} className={tr.applied ? "bg-green-50 font-medium" : undefined}>
                  <Td>{t(`rules.${tr.rule}`)}</Td>
                  <Td className="num">{formatMoney(tr.unitPrice)}</Td>
                  <Td className="num text-xs text-ink-600">{tr.note}</Td>
                  <Td>{tr.applied ? <Badge tone="green">{t("applied")}</Badge> : null}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
