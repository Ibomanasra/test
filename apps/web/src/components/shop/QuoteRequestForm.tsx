"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

/** Freitext + optionale Zeilen "SKU Menge" */
export function QuoteRequestForm() {
  const t = useTranslations("account.quotes");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [note, setNote] = useState("");
  const [lines, setLines] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines
      .split(/\n/)
      .map((l) => l.trim().split(/[\s,;]+/))
      .filter((p) => p[0])
      .map(([sku, qty]) => ({ sku: sku!, qty: Math.max(1, Number(qty) || 1) }));
    const res = await call("/api/v1/quotes", { body: { note, items } });
    if (res) {
      setDone(true);
      setNote("");
      setLines("");
      router.refresh();
    }
  }

  return (
    <Card title={t("request")}>
      <form method="post" onSubmit={submit} className="space-y-3">
        <Field label={t("requestNote")} htmlFor="qr-note">
          <Textarea id="qr-note" value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} />
        </Field>
        <Field label={t("requestItems")} htmlFor="qr-lines" hint={t("requestItemsHint")}>
          <Textarea id="qr-lines" dir="ltr" className="num" value={lines} onChange={(e) => setLines(e.target.value)} placeholder={"CL-001 120\nPA-002 40"} />
        </Field>
        {error ? <Alert tone="red">{error}</Alert> : null}
        {done ? <Alert tone="green">{t("requestSent")}</Alert> : null}
        <Button type="submit" disabled={pending}>{t("send")}</Button>
      </form>
    </Card>
  );
}
