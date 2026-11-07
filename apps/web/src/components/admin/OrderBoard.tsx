"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { ORDER_STATUS_TONE } from "@/components/admin/status";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Badge, Button, EmptyState, cn } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { CompanyPicker, choiceBody, choiceReady, emptyChoice } from "./CompanyPicker";

export interface OrderRow {
  id: string;
  number: string;
  customer: string;
  customerNo: string;
  channel: "B2C" | "B2B";
  channelLabel: string;
  status: keyof typeof ORDER_STATUS_TONE;
  statusLabel: string;
  zone: string;
  city: string;
  placedAt: string;
  deliveryDay: string;
  /** "today" | "tomorrow" | "late" | "" */
  deliveryHint: string;
  items: number;
  total: string;
  /** Verkaufspreis der Ware (ohne Lieferung) */
  goods: string;
  /** Lieferkosten; "" = kostenlos */
  delivery: string;
  payment: string;
  paid: boolean;
  /** Zustellfirma des offenen Lieferscheins (unterwegs) */
  company?: string;
  /** Betrag, den die Zustellfirma beim Kunden kassiert */
  cod?: string;
}

type Step = "CONFIRMED" | "READY";
/** 3 Schritte: 1 Bestätigen → 2 Vorbereitet → 3 Übergeben (Dialog) */
const NEXT: Partial<Record<OrderRow["status"], Step>> = { NEW: "CONFIRMED", CONFIRMED: "READY", PICKING: "READY" };

/**
 * Tagesarbeit: Zeilen mit „nächster Schritt“-Knopf, Mehrfachauswahl für
 * Sammel-Weiterschalten und Sammeldruck (A4-PDF mehrerer Bestellungen).
 */
export function OrderBoard({ rows, canConfirm, canStatus, companies = [] }: { rows: OrderRow[]; canConfirm: boolean; canStatus: boolean; companies?: { id: string; name: string }[] }) {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("common");
  const router = useRouter();
  const { call, error, pending } = useApi();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** Übergabe-Dialog für diese Bestellungen */
  const [handOver, setHandOver] = useState<string[] | null>(null);
  const [company, setCompany] = useState(() => emptyChoice(companies));

  const allowed = (s: Step) => (s === "CONFIRMED" ? canConfirm : canStatus);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function advance(ids: string[]) {
    let ok = 0;
    for (const id of ids) {
      const row = rows.find((r) => r.id === id);
      const to = row ? NEXT[row.status] : undefined;
      if (!to || !allowed(to)) continue;
      setBusy(id);
      const res = await call(`/api/v1/admin/orders/${id}/status`, { body: { to } });
      if (res) ok++;
    }
    setBusy(null);
    setSel(new Set());
    setDone(ok ? t("board.advanced", { count: ok }) : null);
    router.refresh();
  }

  async function doHandOver(ids: string[]) {
    let ok = 0;
    for (const id of ids) {
      setBusy(id);
      if (await call(`/api/v1/admin/orders/${id}/dispatch`, { body: { remainder: "BACKORDER", ...choiceBody(company) } })) ok++;
      else break;
    }
    setBusy(null);
    setHandOver(null);
    setSel(new Set());
    setDone(ok ? t("board.handedOver", { count: ok }) : null);
    router.refresh();
  }

  async function delivered(id: string) {
    setBusy(id);
    const ok = await call(`/api/v1/admin/orders/${id}/deliver`, { body: {} });
    setBusy(null);
    if (ok) {
      setDone(t("board.deliveredOne"));
      router.refresh();
    }
  }

  if (rows.length === 0) return <EmptyState>{tc("noResults")}</EmptyState>;
  const ids = [...sel].join(",");
  const advanceable = [...sel].filter((id) => { const r = rows.find((x) => x.id === id); const to = r && NEXT[r.status]; return to && allowed(to); });
  const readySel = canStatus ? [...sel].filter((id) => rows.find((x) => x.id === id)?.status === "READY") : [];

  return (
    <div className="space-y-3">
      {/* Aktionsleiste */}
      <div className={cn("flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm transition", sel.size ? "bg-brand-50 ring-1 ring-brand-200" : "bg-white ring-1 ring-ink-200")}>
        <span className="font-medium text-ink-700">{sel.size ? t("selected", { count: sel.size }) : t("board.selectHint")}</span>
        {sel.size ? (
          <>
            <Button size="sm" disabled={!advanceable.length || pending} onClick={() => advance(advanceable)} data-testid="batch-advance">
              <Icon name="check" className="size-4" /> {t("board.advanceSelected", { count: advanceable.length })}
            </Button>
            {readySel.length ? (
              <Button size="sm" disabled={pending} onClick={() => setHandOver(readySel)} data-testid="batch-handover">
                🚚 {t("board.handOverSelected", { count: readySel.length })}
              </Button>
            ) : null}
            {([["order-confirmation", "order-confirmation"], ["pick-list", "pick-list"], ["delivery-note", "delivery-note"], ["invoice", "invoice"], ["delivery-note,invoice", "dn-invoice"]] as const).map(([doc, key]) => (
              <a key={key} className="rounded-lg bg-white px-2.5 py-1 ring-1 ring-ink-300 hover:bg-ink-50" href={`/api/v1/print/batch?doc=${doc}&ids=${ids}`} target="_blank" rel="noopener" data-testid={`batch-${key}`}>
                {t(`batch.${key}`)}
              </a>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>{t("clearSelection")}</Button>
          </>
        ) : null}
        <span className="ms-auto">
          <PrintTableButton
            data={{
              title: t("title"),
              columns: [
                { key: "number", label: tc("number") },
                { key: "customer", label: t("customer") },
                { key: "channel", label: t("channel") },
                { key: "status", label: tc("status") },
                { key: "zone", label: t("zone") },
                { key: "placedAt", label: t("placedAt"), kind: "num" },
                { key: "deliveryDay", label: t("deliveryDay"), kind: "num" },
                { key: "goods", label: t("goodsValue"), kind: "num" },
                { key: "delivery", label: t("deliveryFee"), kind: "num" },
                { key: "total", label: t("total"), kind: "num" },
              ],
              rows: (sel.size ? rows.filter((r) => sel.has(r.id)) : rows).map((r) => ({ number: r.number, customer: r.customer, channel: r.channelLabel, status: r.statusLabel, zone: [r.city, r.zone].filter(Boolean).join(" · "), placedAt: r.placedAt, deliveryDay: r.deliveryDay, goods: r.goods, delivery: r.delivery || t("deliveryFree"), total: r.total })),
            }}
          />
        </span>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {handOver ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={() => setHandOver(null)}>
          <div className="w-full max-w-lg space-y-4 rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} data-testid="handover-dialog">
            <div>
              <h2 className="text-lg font-bold text-ink-900">🚚 {t("steps.do3")}</h2>
              <p className="text-sm text-ink-600">{t("board.handOverText", { count: handOver.length })}</p>
              <p className="num mt-1 text-xs text-ink-500">{handOver.map((id) => rows.find((r) => r.id === id)?.number).join(" · ")}</p>
            </div>
            <CompanyPicker companies={companies} value={company} onChange={setCompany} />
            <div className="flex gap-2">
              <Button disabled={pending || busy != null || !choiceReady(company)} onClick={() => void doHandOver(handOver)} data-testid="handover-confirm">✓ {t("handOverNow")}</Button>
              <Button variant="secondary" onClick={() => setHandOver(null)}>{tc("cancel")}</Button>
            </div>
          </div>
        </div>
      ) : null}
      {done ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status">{done}</p> : null}

      <div className="relative overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-ink-200">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-50 text-xs text-ink-500">
            <tr>
              <th className="w-10 px-3 py-2.5 text-start">
                <input type="checkbox" aria-label={t("selectAll")} checked={sel.size === rows.length} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} className="accent-brand-700" />
              </th>
              <th className="px-3 py-2.5 text-start font-medium">{t("board.order")}</th>
              <th className="px-3 py-2.5 text-start font-medium">{t("customer")}</th>
              <th className="px-3 py-2.5 text-start font-medium">{t("deliveryDay")}</th>
              <th className="px-3 py-2.5 text-end font-medium">{t("total")}</th>
              <th className="px-3 py-2.5 text-start font-medium">{tc("status")}</th>
              <th className="px-3 py-2.5 text-end font-medium"><span className="sr-only">{t("board.action")}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => {
              const next = NEXT[r.status];
              return (
                <tr key={r.id} data-testid="order-row" className={cn("transition hover:bg-ink-50/70", sel.has(r.id) && "bg-brand-50/60 hover:bg-brand-50")}>
                  <td className="px-3 py-3 align-top"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={r.number} className="accent-brand-700" /></td>
                  <td className="px-3 py-3 align-top">
                    <Link href={`/admin/orders/${r.id}`} className="num font-semibold text-ink-900 hover:text-brand-700 hover:underline">{r.number}</Link>
                    <p className="num mt-0.5 text-xs text-ink-500">{r.placedAt} · {t("board.items", { count: r.items })}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="flex items-center gap-2 font-medium text-ink-900">
                      {r.customer}
                      <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold", r.channel === "B2B" ? "bg-orange-100 text-orange-800" : "bg-sky-100 text-sky-800")}>{r.channelLabel}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">{[r.city, r.zone].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    {r.deliveryHint ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", r.deliveryHint === "late" ? "bg-red-100 text-red-800" : r.deliveryHint === "today" ? "bg-amber-100 text-amber-900" : "bg-ink-100 text-ink-700")}>
                        {t(`board.when.${r.deliveryHint}`)}
                      </span>
                    ) : null}
                    <p className="num mt-0.5 text-xs text-ink-500">{r.deliveryDay}</p>
                  </td>
                  <td className="px-3 py-3 text-end align-top">
                    <p className="num font-semibold text-ink-900">{r.total}</p>
                    <p className="whitespace-nowrap text-[11px] text-ink-500" data-testid="row-split">
                      {t("board.goods")} <span className="num">{r.goods}</span> · {t("board.delivery")} {r.delivery ? <span className="num">{r.delivery}</span> : <span className="text-green-700">{t("deliveryFree")}</span>}
                    </p>
                    <p className={cn("mt-0.5 text-xs", r.paid ? "text-green-700" : "text-ink-500")}>{r.payment}</p>
                  </td>
                  <td className="px-3 py-3 align-top"><Badge tone={ORDER_STATUS_TONE[r.status]}>{r.statusLabel}</Badge></td>
                  <td className="px-3 py-3 text-end align-top">
                    {next && allowed(next) ? (
                      <Button size="sm" variant={r.status === "NEW" ? "primary" : "secondary"} disabled={busy != null} onClick={() => advance([r.id])} data-testid="row-advance" className="whitespace-nowrap">
                        {busy === r.id ? "…" : t(`board.next.${next}`)}
                      </Button>
                    ) : r.status === "READY" && canStatus ? (
                      <Button size="sm" disabled={busy != null} onClick={() => setHandOver([r.id])} data-testid="row-handover" className="whitespace-nowrap">
                        🚚 {t("board.handOver")}
                      </Button>
                    ) : r.status === "OUT_FOR_DELIVERY" && canStatus ? (
                      <div className="flex flex-col items-end gap-1">
                        {r.company ? <span className="whitespace-nowrap text-xs text-ink-500">🚚 {r.company}</span> : null}
                        {r.cod ? <span className="whitespace-nowrap text-xs font-medium text-amber-800" data-testid="row-cod">💵 {t("board.collects", { amount: r.cod })}</span> : null}
                        <Button size="sm" variant="secondary" disabled={busy != null} onClick={() => void delivered(r.id)} data-testid="row-delivered" className="whitespace-nowrap">
                          {busy === r.id ? "…" : `✓ ${t("board.markDelivered")}`}
                        </Button>
                      </div>
                    ) : (
                      <Link href={`/admin/orders/${r.id}`} className="text-sm text-ink-500 hover:text-ink-900">{t("board.open")}</Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
