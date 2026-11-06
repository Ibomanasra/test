"use client";

import { formatBps, formatMoney, grossToNet, marginBpsOf, parseShekel } from "@sa/core";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { Button, EmptyState, cn } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { ApiError, apiFetch } from "@/lib/api-client";

export interface PriceRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  b2cPrice: number;
  b2bBasePrice: number;
}

type Field = "costPrice" | "b2cPrice" | "b2bBasePrice";
const toInput = (a: number) => formatMoney(a, { symbol: false, grouping: false });
const parse = (s: string): number | null => {
  try {
    return parseShekel(s);
  } catch {
    return null;
  }
};

/**
 * Schnelle Preispflege: Einkauf, Endkunde (Endpreis) und Händler (netto) direkt in der Zeile.
 * Marge wird live berechnet; Speichern pro Zeile (Enter oder Knopf).
 */
export function PriceGrid({
  rows,
  taxRateBps,
  minMarginBps,
  canSeeCost,
  canEdit,
  canConfirmBelow,
}: {
  rows: PriceRow[];
  taxRateBps: number;
  minMarginBps: number;
  canSeeCost: boolean;
  canEdit: boolean;
  canConfirmBelow: boolean;
}) {
  const t = useTranslations("admin.prices");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, Partial<Record<Field, string>>>>({});
  const [state, setState] = useState<Record<string, { saving?: boolean; saved?: boolean; error?: string }>>({});

  if (rows.length === 0) return <EmptyState>{tc("noResults")}</EmptyState>;

  const value = (r: PriceRow, f: Field) => draft[r.id]?.[f] ?? toInput(r[f]);
  const dirty = (r: PriceRow) => (["costPrice", "b2cPrice", "b2bBasePrice"] as Field[]).some((f) => draft[r.id]?.[f] !== undefined && parse(draft[r.id]![f]!) !== r[f]);

  async function save(r: PriceRow, confirm = false) {
    const body: Partial<Record<Field, number>> & { confirmBelowMargin: boolean } = { confirmBelowMargin: confirm };
    for (const f of ["costPrice", "b2cPrice", "b2bBasePrice"] as Field[]) {
      const d = draft[r.id]?.[f];
      if (d === undefined) continue;
      const v = parse(d);
      if (v == null) return setState((s) => ({ ...s, [r.id]: { error: te("invalid_amount") } }));
      if (v !== r[f]) body[f] = v;
    }
    setState((s) => ({ ...s, [r.id]: { saving: true } }));
    try {
      await apiFetch(`/api/v1/admin/prices/variants/${r.id}`, { method: "PUT", body });
      setDraft((d) => {
        const n = { ...d };
        delete n[r.id];
        return n;
      });
      setState((s) => ({ ...s, [r.id]: { saved: true } }));
      router.refresh();
      setTimeout(() => setState((s) => ({ ...s, [r.id]: {} })), 2000);
    } catch (err) {
      if (err instanceof ApiError && err.body.code === "below_margin") {
        if (canConfirmBelow && window.confirm(t("grid.belowMarginConfirm"))) return save(r, true);
        return setState((s) => ({ ...s, [r.id]: { error: t("grid.belowMarginError") } }));
      }
      const code = err instanceof ApiError ? err.body.code : "generic";
      setState((s) => ({ ...s, [r.id]: { error: te.has(code) ? te(code) : te("generic") } }));
    }
  }

  const input = (r: PriceRow, f: Field, label: string) => (
    <div className="relative">
      <input
        aria-label={`${label} ${r.sku}`}
        inputMode="decimal"
        dir="ltr"
        disabled={!canEdit}
        value={value(r, f)}
        onChange={(e) => setDraft((d) => ({ ...d, [r.id]: { ...d[r.id], [f]: e.target.value } }))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty(r)) void save(r);
          if (e.key === "Escape") setDraft((d) => ({ ...d, [r.id]: {} }));
        }}
        data-testid={`price-${f}`}
        className={cn(
          "num w-28 rounded-lg border bg-white py-1.5 pe-7 ps-2.5 text-end text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-ink-50",
          draft[r.id]?.[f] !== undefined && parse(draft[r.id]![f]!) !== r[f] ? "border-amber-400 bg-amber-50" : "border-ink-200",
          draft[r.id]?.[f] !== undefined && parse(draft[r.id]![f]!) == null && "border-red-400 bg-red-50",
        )}
      />
      <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-xs text-ink-400">₪</span>
    </div>
  );

  const marginChip = (bps: number | null) => {
    if (bps == null) return <span className="text-ink-400">–</span>;
    const low = bps < minMarginBps;
    return <span className={cn("num rounded-full px-2 py-0.5 text-xs font-semibold", low ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800")}>{formatBps(Math.round(bps))}</span>;
  };

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-ink-200">
      <table className="min-w-full text-sm" data-testid="price-grid">
        <thead className="bg-ink-50 text-xs text-ink-500">
          <tr>
            <th className="px-3 py-2.5 text-start font-medium">{t("product")}</th>
            {canSeeCost ? <th className="px-3 py-2.5 text-start font-medium">{t("cost")}</th> : null}
            <th className="px-3 py-2.5 text-start font-medium">{t("grid.b2c")}<span className="block font-normal text-ink-400">{t("grid.b2cSub")}</span></th>
            <th className="px-3 py-2.5 text-start font-medium">{t("grid.b2b")}<span className="block font-normal text-ink-400">{t("grid.b2bSub")}</span></th>
            {canSeeCost ? <th className="px-3 py-2.5 text-start font-medium">{t("margin")}<span className="block font-normal text-ink-400">{t("grid.marginSub")}</span></th> : null}
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => {
            const cost = parse(value(r, "costPrice")) ?? r.costPrice;
            const b2c = parse(value(r, "b2cPrice"));
            const b2b = parse(value(r, "b2bBasePrice"));
            const mC = b2c ? marginBpsOf(grossToNet(b2c, taxRateBps), cost) : null;
            const mB = b2b ? marginBpsOf(b2b, cost) : null;
            const st = state[r.id] ?? {};
            const isDirty = dirty(r);
            return (
              <tr key={r.id} data-testid="price-row" className={cn(isDirty && "bg-amber-50/40")}>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-ink-900">{r.name}</p>
                  <p className="text-xs text-ink-500"><span className="num">{r.sku}</span> · {r.category}</p>
                </td>
                {canSeeCost ? <td className="px-3 py-2.5">{input(r, "costPrice", t("cost"))}</td> : null}
                <td className="px-3 py-2.5">{input(r, "b2cPrice", t("grid.b2c"))}</td>
                <td className="px-3 py-2.5">{input(r, "b2bBasePrice", t("grid.b2b"))}</td>
                {canSeeCost ? <td className="whitespace-nowrap px-3 py-2.5"><span className="inline-flex gap-1">{marginChip(mC)}{marginChip(mB)}</span></td> : null}
                <td className="w-32 px-3 py-2.5 text-end">
                  {st.error ? <p className="mb-1 text-xs text-red-700">{st.error}</p> : null}
                  {isDirty ? (
                    <Button size="sm" disabled={st.saving} onClick={() => void save(r)} data-testid="price-save">{st.saving ? "…" : tc("save")}</Button>
                  ) : st.saved ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><Icon name="check" className="size-4" />{t("grid.saved")}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
