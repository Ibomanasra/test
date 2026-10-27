"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { useHydrated } from "@/lib/use-hydrated";

export function QuickOrderForm() {
  const t = useTranslations("account.quick");
  const te = useTranslations("errors");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const hydrated = useHydrated();
  const [text, setText] = useState("");
  const [res, setRes] = useState<{ added: { sku: string; qty: number; unitCode: string }[]; errors: { line: number; text: string; code: string }[] } | null>(null);

  async function submit(content: string) {
    const r = await call<typeof res>("/api/v1/cart/quick", { body: { text: content } });
    if (r) {
      setRes(r);
      router.refresh();
    }
  }

  return (
    <Card title={t("title")}>
      <p className="mb-3 text-sm text-ink-600">{t("text")}</p>
      <form method="post" className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(text); }}>
        <Field label={t("lines")} htmlFor="qo-text" hint={t("hint")}>
          <Textarea id="qo-text" dir="ltr" className="num min-h-40" value={text} onChange={(e) => setText(e.target.value)} placeholder={"CL-001 5\nPA-002 2 CARTON\nBA-003 24 PIECE"} required />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || !hydrated} data-testid="quick-submit">{t("addAll")}</Button>
          <Field label={t("csv")} htmlFor="qo-file">
            <Input id="qo-file" type="file" accept=".csv,text/csv,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await submit(await f.text()); }} />
          </Field>
        </div>
      </form>
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
      {res ? (
        <div className="mt-4 space-y-2">
          <Alert tone={res.errors.length ? "amber" : "green"} data-testid="quick-result">
            {t("result", { added: res.added.length, errors: res.errors.length })}{" "}
            {res.added.length ? <button className="underline" onClick={() => router.push("/cart")}>{t("toCart")}</button> : null}
          </Alert>
          {res.errors.map((e) => (
            <p key={e.line} className="num text-sm text-red-700">#{e.line} {e.text}: {te.has(e.code) ? te(e.code) : e.code}</p>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
