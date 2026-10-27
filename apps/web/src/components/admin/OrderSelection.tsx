"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge, Button, EmptyState, Table, Td, Th } from "@/components/ui";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Link } from "@/i18n/navigation";

export interface OrderRow {
  id: string;
  number: string;
  customer: string;
  channel: string;
  status: string;
  statusLabel: string;
  zone: string;
  placedAt: string;
  deliveryDay: string;
  total: string;
  payment: string;
}

const TONE: Record<string, "amber" | "blue" | "brand" | "green" | "red" | "neutral"> = {
  NEW: "amber",
  CONFIRMED: "blue",
  PICKING: "blue",
  READY: "brand",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "green",
  CANCELLED: "red",
};

/** Liste mit Mehrfachauswahl für Sammeldruck (A4-PDF mehrerer Bestellungen) */
export function OrderSelection({ rows }: { rows: OrderRow[] }) {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("common");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  if (rows.length === 0) return <EmptyState>{tc("noResults")}</EmptyState>;
  const ids = [...sel].join(",");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-600">{t("selected", { count: sel.size })}</span>
        {([["order-confirmation", "order-confirmation"], ["pick-list", "pick-list"], ["delivery-note", "delivery-note"], ["invoice", "invoice"], ["delivery-note,invoice", "dn-invoice"]] as const).map(([doc, key]) => (
          <a
            key={key}
            aria-disabled={sel.size === 0}
            className={sel.size === 0 ? "pointer-events-none rounded-lg px-3 py-1.5 text-ink-400 ring-1 ring-ink-200" : "rounded-lg px-3 py-1.5 ring-1 ring-ink-300 hover:bg-ink-100"}
            href={`/api/v1/print/batch?doc=${doc}&ids=${ids}`}
            target="_blank"
            rel="noopener"
            data-testid={`batch-${key}`}
          >
            {t(`batch.${key}`)}
          </a>
        ))}
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
                { key: "total", label: t("total"), kind: "num" },
              ],
              rows: (sel.size ? rows.filter((r) => sel.has(r.id)) : rows).map((r) => ({ number: r.number, customer: r.customer, channel: r.channel, status: r.statusLabel, zone: r.zone, placedAt: r.placedAt, deliveryDay: r.deliveryDay, total: r.total })),
            }}
          />
        </span>
        {sel.size ? <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>{t("clearSelection")}</Button> : null}
      </div>
      <Table>
        <thead>
          <tr>
            <Th><input type="checkbox" aria-label={t("selectAll")} checked={sel.size === rows.length} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} className="accent-brand-700" /></Th>
            <Th>{tc("number")}</Th>
            <Th>{t("customer")}</Th>
            <Th>{t("channel")}</Th>
            <Th>{tc("status")}</Th>
            <Th>{t("zone")}</Th>
            <Th>{t("placedAt")}</Th>
            <Th>{t("deliveryDay")}</Th>
            <Th>{t("total")}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => (
            <tr key={r.id} data-testid="order-row" className={sel.has(r.id) ? "bg-brand-50" : undefined}>
              <Td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={r.number} className="accent-brand-700" /></Td>
              <Td><Link href={`/admin/orders/${r.id}`} className="num font-medium text-brand-700 hover:underline">{r.number}</Link></Td>
              <Td>{r.customer}</Td>
              <Td>{r.channel}</Td>
              <Td><Badge tone={TONE[r.status] ?? "neutral"}>{r.statusLabel}</Badge></Td>
              <Td>{r.zone}</Td>
              <Td className="num text-xs">{r.placedAt}</Td>
              <Td className="num text-xs">{r.deliveryDay}</Td>
              <Td className="num">{r.total}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
