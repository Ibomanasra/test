"use client";

import { parseShekel } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

interface Row {
  sku: string;
  unitCode: string;
  qty: string;
  unitCost: string;
}

export function PurchaseOrderEditor({
  poId,
  suppliers,
  skuOptions,
  unitNames,
  initial,
}: {
  poId?: string;
  suppliers: { value: string; label: string }[];
  skuOptions: { sku: string; label: string }[];
  unitNames: Record<string, string>;
  initial?: { supplierId: string; expectedAt: string; note: string; items: Row[] };
}) {
  const t = useTranslations("admin.purchasing");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [expectedAt, setExpectedAt] = useState(initial?.expectedAt ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [rows, setRows] = useState<Row[]>(initial?.items.length ? initial.items : [{ sku: "", unitCode: "CARTON", qty: "1", unitCost: "" }]);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function save() {
    let items;
    try {
      items = rows.filter((r) => r.sku.trim()).map((r) => ({ sku: r.sku.trim(), unitCode: r.unitCode, qty: Number(r.qty), unitCost: parseShekel(r.unitCost) }));
    } catch {
      setError(t("invalidAmount"));
      return;
    }
    const body = { supplierId, expectedAt: expectedAt || null, note: note || undefined, items };
    const res = poId ? await call(`/api/v1/admin/purchase-orders/${poId}`, { method: "PUT", body, locale }) : await call<{ id: string }>("/api/v1/admin/purchase-orders", { body, locale });
    if (res) router.push(`/admin/purchasing/${poId ?? (res as { id: string }).id}`);
  }

  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("supplier")} htmlFor="po-supplier">
          <Select id="po-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="" disabled>–</option>
            {suppliers.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label={t("expectedAt")} htmlFor="po-expected"><Input id="po-expected" type="date" dir="ltr" className="num" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} /></Field>
        <Field label={t("note")} htmlFor="po-note"><Input id="po-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <datalist id="po-skus">{skuOptions.map((s) => <option key={s.sku} value={s.sku}>{s.label}</option>)}</datalist>
      <div className="mt-4">
        <Table>
          <thead><tr><Th>SKU</Th><Th>{t("unit")}</Th><Th>{t("qty")}</Th><Th>{t("unitCost")}</Th><Th /></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r, i) => (
              <tr key={i} data-testid="po-line">
                <Td><Input list="po-skus" dir="ltr" className="num" value={r.sku} onChange={(e) => set(i, { sku: e.target.value })} aria-label="SKU" /></Td>
                <Td>
                  <Select value={r.unitCode} onChange={(e) => set(i, { unitCode: e.target.value })} aria-label={t("unit")}>
                    {Object.entries(unitNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </Select>
                </Td>
                <Td><Input type="number" min={1} dir="ltr" className="num w-24" value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} aria-label={t("qty")} /></Td>
                <Td><Input inputMode="decimal" dir="ltr" className="num w-32" value={r.unitCost} onChange={(e) => set(i, { unitCost: e.target.value })} aria-label={t("unitCost")} /></Td>
                <Td><Button variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>✕</Button></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setRows([...rows, { sku: "", unitCode: "CARTON", qty: "1", unitCost: "" }])}>{t("addLine")}</Button>
        <Button onClick={() => void save()} disabled={pending || !supplierId} data-testid="po-save">{tc("save")}</Button>
      </div>
      <p className="mt-2 text-xs text-ink-500">{t("unitCostHint")}</p>
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
    </Card>
  );
}

/** Wareneingang: Mengen je Position (Basiseinheit), optional abweichender Preis und Lagerplatz */
export function GoodsReceiptForm({ poId, items, bins }: { poId: string; items: { id: string; sku: string; name: string; open: number; unitCost: string; binId: string }[]; bins: { value: string; label: string }[] }) {
  const t = useTranslations("admin.purchasing");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const [mode, setMode] = useState<"WEIGHTED_AVG" | "LAST">("WEIGHTED_AVG");
  const [vals, setVals] = useState<Record<string, { qty: string; cost: string; bin: string }>>(() => Object.fromEntries(items.map((i) => [i.id, { qty: String(i.open), cost: "", bin: i.binId }])));
  const [done, setDone] = useState<string | null>(null);

  async function receive() {
    let lines;
    try {
      lines = items.map((i) => {
        const v = vals[i.id]!;
        return { poItemId: i.id, qtyBase: Number(v.qty) || 0, unitCostNet: v.cost.trim() ? parseShekel(v.cost) : null, binId: v.bin || null };
      });
    } catch {
      setError(t("invalidAmount"));
      return;
    }
    const res = await call<{ number: string }>(`/api/v1/admin/purchase-orders/${poId}/receive`, { body: { costUpdateMode: mode, items: lines }, locale });
    if (res) {
      setDone(res.number);
      router.refresh();
    }
  }

  return (
    <Card title={t("receive")}>
      <Table>
        <thead><tr><Th>SKU</Th><Th>{t("product")}</Th><Th>{t("openQty")}</Th><Th>{t("receiveQty")}</Th><Th>{t("costPerPiece")}</Th><Th>{t("bin")}</Th></tr></thead>
        <tbody className="divide-y divide-ink-100">
          {items.map((i) => (
            <tr key={i.id}>
              <Td className="num">{i.sku}</Td>
              <Td>{i.name}</Td>
              <Td className="num">{i.open}</Td>
              <Td><Input type="number" min={0} dir="ltr" className="num w-24" value={vals[i.id]!.qty} onChange={(e) => setVals({ ...vals, [i.id]: { ...vals[i.id]!, qty: e.target.value } })} aria-label={`${t("receiveQty")} ${i.sku}`} /></Td>
              <Td><Input inputMode="decimal" dir="ltr" className="num w-28" placeholder={i.unitCost} value={vals[i.id]!.cost} onChange={(e) => setVals({ ...vals, [i.id]: { ...vals[i.id]!, cost: e.target.value } })} aria-label={t("costPerPiece")} /></Td>
              <Td>
                <Select value={vals[i.id]!.bin} onChange={(e) => setVals({ ...vals, [i.id]: { ...vals[i.id]!, bin: e.target.value } })} aria-label={t("bin")}>
                  <option value="">–</option>
                  {bins.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </Select>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Select value={mode} onChange={(e) => setMode(e.target.value as "WEIGHTED_AVG" | "LAST")} className="w-auto" aria-label={t("costModeLabel")}>
          <option value="WEIGHTED_AVG">{t("costMode.WEIGHTED_AVG")}</option>
          <option value="LAST">{t("costMode.LAST")}</option>
        </Select>
        <Button onClick={() => void receive()} disabled={pending} data-testid="receive-submit">{t("receiveSubmit")}</Button>
        {done ? <span className="text-sm text-green-700" role="status">{t("received", { number: done })}</span> : null}
      </div>
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
    </Card>
  );
}
