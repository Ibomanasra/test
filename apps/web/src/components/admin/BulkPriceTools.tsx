"use client";

import { formatMoney, parsePercentToBps } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { ApiError, apiFetch, useApi } from "@/lib/api-client";

interface BulkRow {
  sku: string;
  nameAr: string;
  nameEn: string;
  oldPrice: number;
  newPrice: number;
  belowMargin: boolean;
}
interface DiffRow {
  line: number;
  sku: string;
  changes: { field: string; oldPrice: number; newPrice: number }[];
  error?: string;
  belowMargin?: boolean;
}

export function BulkPriceTools({ categories, canSeeCost }: { categories: { value: string; label: string }[]; canSeeCost: boolean }) {
  const t = useTranslations("admin.prices");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const { run, pending, error, setError } = useApi();
  const [form, setForm] = useState({ categoryId: "", field: "B2C", change: "", rounding: "NONE", effectiveAt: "" });
  const [preview, setPreview] = useState<BulkRow[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [diff, setDiff] = useState<DiffRow[] | null>(null);
  const [importConfirm, setImportConfirm] = useState(false);

  function body(apply: boolean, confirm = false) {
    return {
      categoryId: form.categoryId,
      field: form.field,
      changeBps: parsePercentToBps(form.change),
      rounding: form.rounding,
      effectiveAt: form.effectiveAt || null,
      apply,
      confirmBelowMargin: confirm,
    };
  }

  async function bulk(apply: boolean, confirm = false) {
    setDone(null);
    let b;
    try {
      b = body(apply, confirm);
    } catch {
      return setError(te("validation_error"));
    }
    try {
      setError(null);
      const res = await apiFetch<{ rows: BulkRow[]; applied: boolean; scheduled?: boolean }>("/api/v1/admin/prices/bulk", { body: b, locale });
      setPreview(res.rows);
      setNeedsConfirm(false);
      if (res.applied) {
        setDone(res.scheduled ? t("bulkScheduled") : t("bulkApplied"));
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError && err.body.code === "below_margin") return setNeedsConfirm(true);
      await run(() => Promise.reject(err));
    }
  }

  async function importFile(apply: boolean, confirm = false) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    if (apply) fd.set("apply", "1");
    if (confirm) fd.set("confirmBelowMargin", "1");
    try {
      setError(null);
      const res = await apiFetch<{ diff: DiffRow[]; applied: boolean; changed?: number }>("/api/v1/admin/prices/import", { form: fd, locale });
      setDiff(res.diff);
      setImportConfirm(false);
      if (res.applied) {
        setDone(t("importDone", { count: res.changed ?? 0 }));
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError && err.body.code === "below_margin") return setImportConfirm(true);
      await run(() => Promise.reject(err));
    }
  }

  const fieldLabel = (f: string) => t(`fieldNames.${f as "B2C" | "B2B_BASE" | "COST"}`);
  const name = (r: { nameAr: string; nameEn: string }) => (locale === "ar" ? r.nameAr : r.nameEn);
  const changed = diff?.filter((d) => d.changes.length > 0) ?? [];
  const errors = diff?.filter((d) => d.error) ?? [];

  return (
    <div className="space-y-6">
      {error ? <Alert tone="red">{error}</Alert> : null}
      {done ? <Alert tone="green">{done}</Alert> : null}

      <Card title={t("bulkTitle")}>
        <p className="mb-4 text-sm text-ink-600">{t("bulkText")}</p>
        <form
          method="post"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            void bulk(false);
          }}
        >
          <Field label={t("category")} htmlFor="b-cat">
            <Select id="b-cat" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">{tc("all")}</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("field")} htmlFor="b-field">
            <Select id="b-field" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
              {["B2C", "B2B_BASE", ...(canSeeCost ? ["COST"] : [])].map((f) => (
                <option key={f} value={f}>{fieldLabel(f)}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("changePct")} htmlFor="b-change" hint={t("changePctHint")}>
            <Input id="b-change" dir="ltr" className="num" required value={form.change} onChange={(e) => setForm({ ...form, change: e.target.value })} />
          </Field>
          <Field label={t("roundingMode")} htmlFor="b-round">
            <Select id="b-round" value={form.rounding} disabled={form.field !== "B2C"} onChange={(e) => setForm({ ...form, rounding: e.target.value })}>
              {["NONE", "END_90", "END_00", "END_50_OR_00", "NEAREST_10"].map((m) => (
                <option key={m} value={m}>{t(`roundingModes.${m as "NONE"}`)}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("effectiveFrom")} htmlFor="b-eff" hint={t("effectiveHint")}>
            <Input id="b-eff" type="date" dir="ltr" className="num" value={form.effectiveAt} onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit" variant="secondary" disabled={pending}>{t("showPreview")}</Button>
            <Button type="button" disabled={pending || !preview} onClick={() => void bulk(true)} data-testid="bulk-apply">{t("applyChanges")}</Button>
          </div>
        </form>
        {needsConfirm ? (
          <div className="mt-4">
            <Alert tone="amber">
              <p>{t("belowMarginText")}</p>
              <Button className="mt-2" variant="danger" size="sm" onClick={() => void bulk(true, true)}>{t("confirmBelowMargin")}</Button>
            </Alert>
          </div>
        ) : null}
        {preview ? (
          <div className="mt-4">
            <p className="mb-2 text-sm text-ink-600">{t("previewCount", { count: preview.filter((r) => r.oldPrice !== r.newPrice).length })}</p>
            <Table>
              <thead>
                <tr>
                  <Th>{t("sku")}</Th>
                  <Th>{t("product")}</Th>
                  <Th>{t("oldPrice")}</Th>
                  <Th>{t("newPrice")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {preview.slice(0, 200).map((r) => (
                  <tr key={r.sku} className={r.belowMargin ? "bg-amber-50" : undefined}>
                    <Td className="num">{r.sku}</Td>
                    <Td>{name(r)}</Td>
                    <Td className="num">{formatMoney(r.oldPrice)}</Td>
                    <Td className="num font-medium">{formatMoney(r.newPrice)}</Td>
                    <Td>{r.belowMargin ? t("belowMarginBadge") : ""}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
      </Card>

      <Card title={t("importExportTitle")}>
        <p className="mb-4 text-sm text-ink-600">{t("importText")}</p>
        <div className="mb-4 flex flex-wrap gap-2">
          <a className="rounded-lg px-4 py-2 text-sm ring-1 ring-ink-300 hover:bg-ink-100" href="/api/v1/admin/prices/export?format=csv">{t("exportCsv")}</a>
          <a className="rounded-lg px-4 py-2 text-sm ring-1 ring-ink-300 hover:bg-ink-100" href="/api/v1/admin/prices/export?format=xlsx">{t("exportXlsx")}</a>
        </div>
        <form
          method="post"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void importFile(false);
          }}
        >
          <Field label={t("importFile")} htmlFor="imp-file">
            <Input id="imp-file" type="file" accept=".csv,.xlsx,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDiff(null); }} required />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending || !file}>{t("showPreview")}</Button>
          <Button type="button" disabled={pending || !diff || errors.length > 0 || changed.length === 0} onClick={() => void importFile(true)} data-testid="import-apply">
            {t("applyChanges")}
          </Button>
        </form>
        {importConfirm ? (
          <div className="mt-4">
            <Alert tone="amber">
              <p>{t("belowMarginText")}</p>
              <Button className="mt-2" variant="danger" size="sm" onClick={() => void importFile(true, true)}>{t("confirmBelowMargin")}</Button>
            </Alert>
          </div>
        ) : null}
        {diff ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-ink-600">{t("importSummary", { rows: diff.length, changed: changed.length, errors: errors.length })}</p>
            <Table>
              <thead>
                <tr>
                  <Th>{t("line")}</Th>
                  <Th>{t("sku")}</Th>
                  <Th>{t("changes")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {[...errors, ...changed].slice(0, 300).map((d) => (
                  <tr key={d.line} className={d.error ? "bg-red-50" : d.belowMargin ? "bg-amber-50" : undefined}>
                    <Td className="num">{d.line}</Td>
                    <Td className="num">{d.sku}</Td>
                    <Td>
                      {d.error
                        ? te.has(d.error) ? te(d.error) : d.error
                        : d.changes.map((c) => (
                            <div key={c.field} className="num">
                              {fieldLabel(c.field)}: {formatMoney(c.oldPrice)} → {formatMoney(c.newPrice)}
                            </div>
                          ))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
