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
  const [mode, setMode] = useState<"dispatch" | "cancel" | "fail" | "deliver" | "return-cancel" | null>(null);
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

  // 2 Schritte: 1 Vorbereiten (mit Fotos/Abhaken) → 2 An Zustellfirma übergeben → erledigt
  const preparing = status === "NEW" || status === "CONFIRMED" || status === "PICKING";
  const to: "READY" | undefined = preparing ? "READY" : undefined;
  const handedOver = status === "OUT_FOR_DELIVERY" || status === "DELIVERED";
  const stepNo = preparing ? 1 : status === "READY" ? 2 : handedOver ? 3 : 0;
  return (
    <div className="space-y-3">
      {stepNo ? (
        <ol className="flex flex-wrap gap-2 text-sm" aria-label={t("steps.title")} data-testid="order-steps">
          {[1, 2, 3].map((n) => (
            <li key={n} className={n < stepNo || (n === 3 && handedOver) ? "rounded-full bg-green-100 px-3 py-1 text-green-800" : n === stepNo ? "rounded-full bg-brand-700 px-3 py-1 font-semibold text-white" : "rounded-full bg-ink-100 px-3 py-1 text-ink-500"}>
              {n < stepNo || (n === 3 && handedOver) ? "✓" : n} · {t(`flow.s${n}`)}
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {to && can.status ? (
          <Button onClick={() => void post("status", { to })} disabled={pending} data-testid="to-READY">✓ {t("flow.doPrepared")}</Button>
        ) : null}
        {status === "READY" && can.status ? <Button onClick={() => setMode("dispatch")} data-testid="open-dispatch">🚚 {t("steps.do3")}</Button> : null}
        {["NEW", "CONFIRMED", "PICKING", "READY"].includes(status) && can.cancel ? (
          <Button variant="danger" onClick={() => setMode("cancel")} data-testid="open-cancel">{t("cancel")}</Button>
        ) : null}
      </div>
      {handedOver ? (
        <div className="rounded-xl bg-green-50 p-4 ring-1 ring-green-200" data-testid="order-done">
          <p className="font-semibold text-green-900">✓ {status === "DELIVERED" ? t("flow.doneDelivered") : t("flow.doneHandedOver")}</p>
          {status === "OUT_FOR_DELIVERY" && can.status ? (
            <div className="mt-3">
              <p className="mb-2 text-sm text-green-900">{t("flow.feedback")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setMode("fail")} data-testid="open-fail">↩️ {t("flow.notDeliverable")}</Button>
                {can.cancel ? <Button size="sm" variant="secondary" onClick={() => setMode("return-cancel")} data-testid="open-return-cancel">✕ {t("flow.cancelReturn")}</Button> : null}
                <Button size="sm" variant="ghost" onClick={() => setMode("deliver")} data-testid="open-deliver">{t("flow.markDelivered")}</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <Alert tone="red">{error}</Alert> : null}

      {mode === "dispatch" ? (
        <Card title={`🚚 ${t("steps.do3")}`}>
          <div className="space-y-4">
            <CompanyPicker companies={companies} value={company} onChange={setCompany} />
            <Field label={t("tracking")} htmlFor="dispatch-tracking" hint={t("trackingHint")}>
              <Input id="dispatch-tracking" dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} className="max-w-xs" data-testid="dispatch-tracking" />
            </Field>
            <details className="rounded-lg bg-ink-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-ink-700" data-testid="dispatch-more">{drivers.length ? t("partialTitle") : t("partialOnly")}</summary>
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

      {mode === "deliver" || mode === "cancel" || mode === "fail" || mode === "return-cancel" ? (
        <Card title={mode === "deliver" ? t("flow.markDelivered") : mode === "cancel" ? t("cancel") : mode === "return-cancel" ? t("flow.cancelReturn") : t("flow.notDeliverable")}>
          {mode === "fail" ? <p className="mb-3 text-sm text-ink-600">{t("flow.notDeliverableHint")}</p> : null}
          {mode === "return-cancel" ? <p className="mb-3 text-sm text-ink-600">{t("flow.cancelReturnHint")}</p> : null}
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
            <Button type="submit" variant={mode === "cancel" || mode === "return-cancel" ? "danger" : "primary"} disabled={pending} data-testid="confirm-action">{tc("save")}</Button>
            <Button type="button" variant="secondary" onClick={() => setMode(null)}>{tc("cancel")}</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
