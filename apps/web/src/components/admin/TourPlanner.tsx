"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, EmptyState, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export interface ShipmentOption {
  id: string;
  number: string;
  order: string;
  customer: string;
  zone: string;
  address: string;
  cod: string;
}

function ShipmentPicker({ shipments, sel, setSel }: { shipments: ShipmentOption[]; sel: Set<string>; setSel: (s: Set<string>) => void }) {
  const t = useTranslations("admin.delivery");
  if (!shipments.length) return <EmptyState>{t("noShipments")}</EmptyState>;
  return (
    <Table>
      <thead><tr><Th><input type="checkbox" aria-label={t("selectAll")} checked={sel.size === shipments.length} onChange={(e) => setSel(e.target.checked ? new Set(shipments.map((s) => s.id)) : new Set())} className="accent-brand-700" /></Th><Th>{t("deliveryNote")}</Th><Th>{t("customer")}</Th><Th>{t("zone")}</Th><Th>{t("address")}</Th><Th>{t("cod")}</Th></tr></thead>
      <tbody className="divide-y divide-ink-100">
        {shipments.map((s) => (
          <tr key={s.id} data-testid="shipment-option">
            <Td><input type="checkbox" checked={sel.has(s.id)} onChange={() => { const n = new Set(sel); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); setSel(n); }} aria-label={s.number} className="accent-brand-700" /></Td>
            <Td className="num">{s.number}<span className="block text-xs text-ink-500">{s.order}</span></Td>
            <Td>{s.customer}</Td>
            <Td>{s.zone}</Td>
            <Td className="text-sm">{s.address}</Td>
            <Td className="num">{s.cod}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Neue Tour: Datum, Fahrer, Lieferscheine auswählen */
export function TourPlanner({ shipments, drivers, zones, today }: { shipments: ShipmentOption[]; drivers: { value: string; label: string }[]; zones: { value: string; label: string }[]; today: string }) {
  const t = useTranslations("admin.delivery");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [date, setDate] = useState(today);
  const [driverId, setDriverId] = useState(drivers[0]?.value ?? "");
  const [zoneId, setZoneId] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  async function create() {
    const res = await call<{ id: string }>("/api/v1/admin/tours", { body: { date, driverId, zoneId: zoneId || null, shipmentIds: [...sel] }, locale });
    if (res) router.push(`/admin/delivery/tours/${res.id}`);
  }

  return (
    <Card title={t("newTour")}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("date")} htmlFor="tp-date"><Input id="tp-date" type="date" dir="ltr" className="num" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t("driver")} htmlFor="tp-driver">
          <Select id="tp-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            {drivers.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
        </Field>
        <Field label={t("zone")} htmlFor="tp-zone">
          <Select id="tp-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">–</option>
            {zones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-4"><ShipmentPicker shipments={shipments} sel={sel} setSel={setSel} /></div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => void create()} disabled={pending || !driverId || !date} data-testid="create-tour">{t("createTour", { count: sel.size })}</Button>
      </div>
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
    </Card>
  );
}

export function AddStops({ tourId, shipments }: { tourId: string; shipments: ShipmentOption[] }) {
  const t = useTranslations("admin.delivery");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [sel, setSel] = useState<Set<string>>(new Set());
  if (!shipments.length) return null;
  return (
    <Card title={t("addStops")}>
      <ShipmentPicker shipments={shipments} sel={sel} setSel={setSel} />
      <Button className="mt-3" disabled={pending || sel.size === 0} onClick={async () => { if (await call(`/api/v1/admin/tours/${tourId}/stops`, { body: { shipmentIds: [...sel] }, locale })) { setSel(new Set()); router.refresh(); } }}>{t("add")}</Button>
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
    </Card>
  );
}
