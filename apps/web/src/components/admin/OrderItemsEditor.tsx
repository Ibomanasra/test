"use client";

import { formatMoney, parseShekel } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Input, Select, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { ApiError, apiFetch, useApi } from "@/lib/api-client";

interface Row {
  sku: string;
  unitCode: string;
  qty: string;
  manual: string;
}

export function OrderItemsEditor({
  orderId,
  initial,
  skuOptions,
  unitNames,
  canEditPrice,
  channel,
}: {
  orderId: string;
  initial: Row[];
  skuOptions: { sku: string; label: string; units: { code: string; factor: number }[] }[];
  unitNames: Record<string, string>;
  canEditPrice: boolean;
  channel: "B2C" | "B2B";
}) {
  const t = useTranslations("admin.orders");
  const tp = useTranslations("admin.prices");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const { run, pending, error, setError } = useApi();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(initial);
  const [confirm, setConfirm] = useState(false);
  const unitsOf = (sku: string) => skuOptions.find((s) => s.sku === sku)?.units ?? [{ code: "PIECE", factor: 1 }];

  async function save(confirmBelowMargin = false) {
    let items;
    try {
      items = rows.filter((r) => r.sku).map((r) => ({ sku: r.sku, unitCode: r.unitCode, qty: Number(r.qty), manualUnitPrice: r.manual ? parseShekel(r.manual) : null }));
    } catch {
      return setError(te("invalid_amount"));
    }
    try {
      setError(null);
      await apiFetch(`/api/v1/admin/orders/${orderId}/items`, { method: "PUT", body: { items, confirmBelowMargin }, locale });
      setOpen(false);
      setConfirm(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.body.code === "below_margin") return setConfirm(true);
      await run(() => Promise.reject(err));
    }
  }

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)} data-testid="edit-items">{t("editItems")}</Button>;
  return (
    <Card title={t("editItems")}>
      <Table>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>{t("unit")}</Th>
            <Th>{t("qty")}</Th>
            {canEditPrice ? <Th>{t("manualPrice", { kind: channel === "B2B" ? "net" : "gross" })}</Th> : null}
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r, idx) => (
            <tr key={idx}>
              <Td><Input list="oe-skus" dir="ltr" className="num min-w-28" value={r.sku} onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)))} /></Td>
              <Td>
                <Select value={r.unitCode} onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, unitCode: e.target.value } : x)))}>
                  {unitsOf(r.sku).map((u) => <option key={u.code} value={u.code}>{unitNames[u.code] ?? u.code} ({u.factor})</option>)}
                </Select>
              </Td>
              <Td><Input type="number" min={1} dir="ltr" className="num w-24" value={r.qty} onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))} /></Td>
              {canEditPrice ? <Td><Input dir="ltr" className="num w-28" value={r.manual} placeholder={t("auto")} onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, manual: e.target.value } : x)))} /></Td> : null}
              <Td><Button size="sm" variant="ghost" onClick={() => setRows(rows.filter((_, i) => i !== idx))}>✕</Button></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <datalist id="oe-skus">{skuOptions.map((o) => <option key={o.sku} value={o.sku}>{o.label}</option>)}</datalist>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setRows([...rows, { sku: "", unitCode: channel === "B2B" ? "CARTON" : "PIECE", qty: "1", manual: "" }])}>{t("addItem")}</Button>
      </div>
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
      {confirm ? (
        <div className="mt-3">
          <Alert tone="amber"><p>{tp("belowMarginText")}</p><Button className="mt-2" size="sm" variant="danger" onClick={() => void save(true)}>{tp("confirmBelowMargin")}</Button></Alert>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-ink-500">{t("editHint", { example: formatMoney(1290) })}</p>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => void save()} disabled={pending} data-testid="save-items">{tc("save")}</Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
      </div>
    </Card>
  );
}
