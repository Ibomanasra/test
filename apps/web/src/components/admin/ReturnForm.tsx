"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export function ReturnForm({ orderId, items }: { orderId: string; items: { id: string; sku: string; name: string; returnable: number }[] }) {
  const t = useTranslations("admin.finance");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  async function submit() {
    const lines = Object.entries(qty).map(([orderItemId, v]) => ({ orderItemId, qtyBase: Number(v) })).filter((l) => l.qtyBase > 0);
    const res = await call<{ number: string; creditNotes: { number: string }[] }>("/api/v1/admin/returns", { body: { orderId, reason, restock, items: lines }, locale });
    if (res) {
      setDone(`${res.number} → ${res.creditNotes.map((c) => c.number).join(", ")}`);
      setQty({});
      router.refresh();
    }
  }
  return (
    <Card title={t("newReturn")}>
      <Table>
        <thead><tr><Th>SKU</Th><Th>{t("item")}</Th><Th>{t("returnable")}</Th><Th>{t("returnQty")}</Th></tr></thead>
        <tbody className="divide-y divide-ink-100">
          {items.map((i) => (
            <tr key={i.id}>
              <Td className="num">{i.sku}</Td>
              <Td>{i.name}</Td>
              <Td className="num">{i.returnable}</Td>
              <Td><Input type="number" min={0} max={i.returnable} dir="ltr" className="num w-24" value={qty[i.id] ?? ""} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} disabled={i.returnable === 0} aria-label={`${t("returnQty")} ${i.sku}`} /></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={t("reason")} htmlFor="ret-reason"><Input id="ret-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="size-4 accent-brand-700" />{t("restock")}</label>
      </div>
      <Button className="mt-3" onClick={() => void submit()} disabled={pending || reason.trim().length < 3 || !Object.values(qty).some((v) => Number(v) > 0)} data-testid="return-submit">{t("createReturn")}</Button>
      {done ? <div className="mt-3"><Alert tone="green">{done}</Alert></div> : null}
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
    </Card>
  );
}
