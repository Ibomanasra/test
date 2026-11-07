"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { CompanyPicker, choiceBody, choiceReady, emptyChoice } from "./CompanyPicker";

interface Item {
  id: string;
  sku: string;
  name: string;
  open: number;
}

export function OrderActions({
  orderId,
  status,
  items,
  can,
  drivers = [],
  companies = [],
}: {
  orderId: string;
  status: string;
  items: Item[];
  can: { confirm: boolean; status: boolean; cancel: boolean };
  /** Fahrer, die beim Laden zugeteilt werden können */
  drivers?: { id: string; name: string }[];
  /** aktive Zustellfirmen für Schritt 3 */
  companies?: { id: string; name: string }[];
}) {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("common");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [mode, setMode] = useState<"dispatch" | "cancel" | "fail" | "deliver" | null>(null);
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i.id, String(i.open)])));
  const [remainder, setRemainder] = useState<"BACKORDER" | "CANCEL">("BACKORDER");
  const [text, setText] = useState("");
  const [driverId, setDriverId] = useState("");
  const [company, setCompany] = useState(() => emptyChoice(companies));
  const [tracking, setTracking] = useState("");

  const post = async (path: string, body: unknown) => {
    if (await call(`/api/v1/admin/orders/${orderId}/${path}`, { body })) {
      setMode(null);
      setText("");
      router.refresh();
    }
  };

  // 3 Schritte: 1 Bestätigen → 2 Vorbereitet → 3 An Zustellfirma übergeben
  const next: Record<string, "CONFIRMED" | "READY" | undefined> = { NEW: "CONFIRMED", CONFIRMED: "READY", PICKING: "READY" };
  const to = next[status];
  const stepNo = status === "NEW" ? 1 : status === "CONFIRMED" || status === "PICKING" ? 2 : status === "READY" ? 3 : 0;
  return (
    <div className="space-y-3">
      {stepNo ? (
        <ol className="flex flex-wrap gap-2 text-sm" aria-label={t("steps.title")} data-testid="order-steps">
          {[1, 2, 3].map((n) => (
            <li key={n} className={n < stepNo ? "rounded-full bg-green-100 px-3 py-1 text-green-800" : n === stepNo ? "rounded-full bg-brand-700 px-3 py-1 font-semibold text-white" : "rounded-full bg-ink-100 px-3 py-1 text-ink-500"}>
              {n < stepNo ? "✓" : n} · {t(`steps.s${n}`)}
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {to && (to === "CONFIRMED" ? can.confirm : can.status) ? (
          <Button onClick={() => void post("status", { to })} disabled={pending} data-testid={`to-${to}`}>{to === "CONFIRMED" ? `✓ ${t("steps.do1")}` : `📦 ${t("steps.do2")}`}</Button>
        ) : null}
        {status === "READY" && can.status ? <Button onClick={() => setMode("dispatch")} data-testid="open-dispatch">🚚 {t("steps.do3")}</Button> : null}
        {status === "OUT_FOR_DELIVERY" && can.status ? (
          <>
            <Button onClick={() => setMode("deliver")} data-testid="open-deliver">{t("delivered")}</Button>
            <Button variant="secondary" onClick={() => setMode("fail")}>{t("failed")}</Button>
          </>
        ) : null}
        {["NEW", "CONFIRMED", "PICKING", "READY"].includes(status) && can.cancel ? (
          <Button variant="danger" onClick={() => setMode("cancel")} data-testid="open-cancel">{t("cancel")}</Button>
        ) : null}
      </div>
      {error ? <Alert tone="red">{error}</Alert> : null}

      {mode === "dispatch" ? (
        <Card title={`🚚 ${t("steps.do3")}`}>
          <div className="space-y-4">
            <CompanyPicker companies={companies} value={company} onChange={setCompany} />
            <Field label={t("tracking")} htmlFor="dispatch-tracking" hint={t("trackingHint")}>
              <Input id="dispatch-tracking" dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} className="max-w-xs" data-testid="dispatch-tracking" />
            </Field>
            <details className="rounded-lg bg-ink-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-ink-700" data-testid="dispatch-more">{t("partialTitle")}</summary>
              <p className="my-2 text-ink-600">{t("dispatchText")}</p>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("product")}</Th>
                    <Th>{t("open")}</Th>
                    <Th>{t("ship")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {items.filter((i) => i.open > 0).map((i) => (
                    <tr key={i.id}>
                      <Td>{i.name} <span className="num text-xs text-ink-500">{i.sku}</span></Td>
                      <Td className="num">{i.open}</Td>
                      <Td><Input type="number" min={0} max={i.open} dir="ltr" className="num w-24" value={qty[i.id]} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} data-testid={`ship-${i.sku}`} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <fieldset className="mt-3 flex flex-wrap gap-4">
                <legend className="mb-1 font-medium">{t("remainder")}</legend>
                <label className="flex items-center gap-2"><input type="radio" checked={remainder === "BACKORDER"} onChange={() => setRemainder("BACKORDER")} className="accent-brand-700" />{t("remainderBackorder")}</label>
                <label className="flex items-center gap-2"><input type="radio" checked={remainder === "CANCEL"} onChange={() => setRemainder("CANCEL")} className="accent-brand-700" />{t("remainderCancel")}</label>
              </fieldset>
              {drivers.length ? (
                <div className="mt-4 max-w-sm">
                  <Field label={t("driver")} htmlFor="dispatch-driver" hint={t("driverHint")}>
                    <Select id="dispatch-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)} data-testid="dispatch-driver">
                      <option value="">{t("noDriver")}</option>
                      {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                  </Field>
                </div>
              ) : null}
            </details>
            <div className="flex flex-wrap gap-2">
              <Button
               
                disabled={pending || (!choiceReady(company) && !driverId)}
                onClick={() => void post("dispatch", { quantities: Object.fromEntries(Object.entries(qty).map(([k, v]) => [k, Number(v) || 0])), remainder, driverId: driverId || undefined, trackingNumber: tracking.trim() || undefined, ...(driverId && !choiceReady(company) ? {} : choiceBody(company)) })}
                data-testid="confirm-dispatch"
              >
                ✓ {t("handOverNow")}
              </Button>
              <Button variant="secondary" onClick={() => setMode(null)}>{tc("cancel")}</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {mode === "deliver" || mode === "cancel" || mode === "fail" ? (
        <Card title={mode === "deliver" ? t("delivered") : mode === "cancel" ? t("cancel") : t("failed")}>
          <form
            method="post"
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void post(mode === "deliver" ? "deliver" : mode, mode === "deliver" ? { receivedByName: text || undefined } : { reason: text });
            }}
          >
            <Field label={mode === "deliver" ? t("receivedBy") : t("reason")} htmlFor="oa-text">
              <Input id="oa-text" value={text} onChange={(e) => setText(e.target.value)} required={mode !== "deliver"} minLength={mode !== "deliver" ? 3 : undefined} />
            </Field>
            <Button type="submit" variant={mode === "cancel" ? "danger" : "primary"} disabled={pending} data-testid="confirm-action">{tc("save")}</Button>
            <Button type="button" variant="secondary" onClick={() => setMode(null)}>{tc("cancel")}</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
