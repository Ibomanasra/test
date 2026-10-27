"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

interface Line {
  id: string;
  sku: string;
  name: string;
  qtyBase: number;
  creditedQtyBase: number;
  lineGross: string;
}

/** Gutschrift erstellen: ganze Rechnung oder ausgewählte Mengen je Zeile */
export function CreditNoteForm({ invoiceId, lines }: { invoiceId: string; lines: Line[] }) {
  const t = useTranslations("admin.documents");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [reason, setReason] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const open = lines.filter((l) => l.qtyBase > l.creditedQtyBase);
  if (open.length === 0) return null;

  async function submit(full: boolean) {
    const sel = Object.entries(qty)
      .map(([invoiceLineId, v]) => ({ invoiceLineId, qtyBase: Number(v) }))
      .filter((l) => Number.isInteger(l.qtyBase) && l.qtyBase > 0);
    if (!full && sel.length === 0) return;
    if (!window.confirm(t("creditConfirm"))) return;
    const res = await call<{ id: string; number: string }>(`/api/v1/admin/invoices/${invoiceId}/credit-notes`, { body: { reason, ...(full ? {} : { lines: sel }) } });
    if (res) {
      setDone(res.number);
      setQty({});
      router.refresh();
    }
  }

  return (
    <Card title={t("createCreditNote")}>
      <Alert tone="blue">{t("creditHint")}</Alert>
      <Table>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>{t("item")}</Th>
            <Th>{t("invoicedQty")}</Th>
            <Th>{t("creditedQty")}</Th>
            <Th>{t("creditQty")}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {open.map((l) => (
            <tr key={l.id}>
              <Td className="num">{l.sku}</Td>
              <Td>{l.name}</Td>
              <Td className="num">{l.qtyBase}</Td>
              <Td className="num">{l.creditedQtyBase}</Td>
              <Td>
                <Input type="number" min={0} max={l.qtyBase - l.creditedQtyBase} dir="ltr" className="num w-24" value={qty[l.id] ?? ""} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} aria-label={`${t("creditQty")} ${l.sku}`} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={t("reason")} htmlFor="cn-reason">
          <Input id="cn-reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void submit(false)} disabled={pending || reason.trim().length < 3 || Object.values(qty).every((v) => !Number(v))} data-testid="credit-selected">{t("creditSelected")}</Button>
        <Button variant="danger" onClick={() => void submit(true)} disabled={pending || reason.trim().length < 3} data-testid="credit-full">{t("creditFull")}</Button>
      </div>
      {done ? <div className="mt-3"><Alert tone="green">{t("creditCreated", { number: done })}</Alert></div> : null}
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
    </Card>
  );
}
