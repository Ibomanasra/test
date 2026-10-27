"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

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
}: {
  orderId: string;
  status: string;
  items: Item[];
  can: { confirm: boolean; status: boolean; cancel: boolean };
}) {
  const t = useTranslations("admin.orders");
  const ts = useTranslations("orderStatus");
  const tc = useTranslations("common");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [mode, setMode] = useState<"dispatch" | "cancel" | "fail" | "deliver" | null>(null);
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i.id, String(i.open)])));
  const [remainder, setRemainder] = useState<"BACKORDER" | "CANCEL">("BACKORDER");
  const [text, setText] = useState("");

  const post = async (path: string, body: unknown) => {
    if (await call(`/api/v1/admin/orders/${orderId}/${path}`, { body })) {
      setMode(null);
      setText("");
      router.refresh();
    }
  };

  const next: Record<string, "CONFIRMED" | "PICKING" | "READY" | undefined> = { NEW: "CONFIRMED", CONFIRMED: "PICKING", PICKING: "READY" };
  const to = next[status];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {to && (to === "CONFIRMED" ? can.confirm : can.status) ? (
          <Button onClick={() => void post("status", { to })} disabled={pending} data-testid={`to-${to}`}>{t("moveTo", { status: ts(to) })}</Button>
        ) : null}
        {status === "READY" && can.status ? <Button onClick={() => setMode("dispatch")} data-testid="open-dispatch">{t("dispatch")}</Button> : null}
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
        <Card title={t("dispatchTitle")}>
          <p className="mb-3 text-sm text-ink-600">{t("dispatchText")}</p>
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>{t("product")}</Th>
                <Th>{t("open")}</Th>
                <Th>{t("ship")}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.filter((i) => i.open > 0).map((i) => (
                <tr key={i.id}>
                  <Td className="num">{i.sku}</Td>
                  <Td>{i.name}</Td>
                  <Td className="num">{i.open}</Td>
                  <Td><Input type="number" min={0} max={i.open} dir="ltr" className="num w-24" value={qty[i.id]} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} data-testid={`ship-${i.sku}`} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <fieldset className="mt-3 flex flex-wrap gap-4 text-sm">
            <legend className="mb-1 font-medium">{t("remainder")}</legend>
            <label className="flex items-center gap-2"><input type="radio" checked={remainder === "BACKORDER"} onChange={() => setRemainder("BACKORDER")} className="accent-brand-700" />{t("remainderBackorder")}</label>
            <label className="flex items-center gap-2"><input type="radio" checked={remainder === "CANCEL"} onChange={() => setRemainder("CANCEL")} className="accent-brand-700" />{t("remainderCancel")}</label>
          </fieldset>
          <div className="mt-4 flex gap-2">
            <Button disabled={pending} onClick={() => void post("dispatch", { quantities: Object.fromEntries(Object.entries(qty).map(([k, v]) => [k, Number(v) || 0])), remainder })} data-testid="confirm-dispatch">{t("dispatchNow")}</Button>
            <Button variant="secondary" onClick={() => setMode(null)}>{tc("cancel")}</Button>
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
