"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/api-client";

export function ProductImport() {
  const t = useTranslations("admin.products");
  const te = useTranslations("errors");
  const { call, pending, error } = useApi();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<{ line: number; sku: string; action: string; error?: string }[] | null>(null);
  const [applied, setApplied] = useState(false);
  async function send(apply: boolean) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    if (apply) fd.set("apply", "1");
    const r = await call<{ applied: boolean; rows: typeof rows }>("/api/v1/admin/products/import", { form: fd });
    if (r) {
      setRows(r.rows);
      setApplied(r.applied);
    }
  }
  const errors = rows?.filter((r) => r.action === "error") ?? [];
  return (
    <Card title={t("importExport")}>
      <p className="mb-3 text-sm text-ink-600">{t("importText")}</p>
      <div className="mb-4 flex gap-2">
        <a className="rounded-lg px-4 py-2 text-sm ring-1 ring-ink-300" href="/api/v1/admin/products/export?format=csv">CSV</a>
        <a className="rounded-lg px-4 py-2 text-sm ring-1 ring-ink-300" href="/api/v1/admin/products/export?format=xlsx">Excel</a>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("importFile")} htmlFor="pi-file"><Input id="pi-file" type="file" accept=".csv,.xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRows(null); }} /></Field>
        <Button variant="secondary" disabled={!file || pending} onClick={() => void send(false)}>{t("check")}</Button>
        <Button disabled={!rows || errors.length > 0 || pending} onClick={() => void send(true)}>{t("apply")}</Button>
      </div>
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
      {applied ? <div className="mt-3"><Alert tone="green">{t("imported", { count: rows?.length ?? 0 })}</Alert></div> : null}
      {rows ? (
        <div className="mt-4">
          <Table>
            <thead><tr><Th>#</Th><Th>SKU</Th><Th>{t("action")}</Th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {rows.slice(0, 300).map((r) => (
                <tr key={r.line} className={r.error ? "bg-red-50" : undefined}>
                  <Td className="num">{r.line}</Td>
                  <Td className="num">{r.sku}</Td>
                  <Td>{r.error ? (te.has(r.error) ? te(r.error) : r.error) : t(`actions.${r.action as "create" | "update"}`)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : null}
    </Card>
  );
}
