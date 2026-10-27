"use client";

import { parsePercentToBps, parseShekel } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Table, Td, Textarea, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { ApiError, apiFetch, useApi } from "@/lib/api-client";

export type FieldType = "text" | "textarea" | "money" | "bps" | "int" | "day" | "datetime" | "select" | "checkbox" | "sku";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  dir?: "ltr" | "rtl";
  /** Feld nur zeigen, wenn ein anderes Feld einen dieser Werte hat */
  showIf?: { field: string; in: string[] };
  /** nur beim Anlegen editierbar */
  createOnly?: boolean;
}

export interface ColumnDef {
  key: string;
  label: string;
  className?: string;
}

export interface CrudRow {
  id: string;
  values: Record<string, string | boolean>;
  cells: Record<string, string>;
  /** Hervorhebung, z. B. „unter Mindestmarge“ */
  tone?: "warn" | "muted";
}

interface Props {
  endpoint: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  rows: CrudRow[];
  canEdit: boolean;
  createLabel: string;
  /** Vorschläge für SKU-Felder */
  skuOptions?: { sku: string; label: string }[];
  defaults?: Record<string, string | boolean>;
  deletable?: boolean;
  deleteLabel?: string;
  emptyText?: string;
  testId?: string;
  allowCreate?: boolean;
}

export function toBody(fields: FieldDef[], values: Record<string, string | boolean>) {
  const body: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.showIf && !f.showIf.in.includes(String(values[f.showIf.field] ?? ""))) {
      body[f.name] = f.type === "checkbox" ? false : null;
      continue;
    }
    const raw = values[f.name];
    if (f.type === "checkbox") {
      body[f.name] = raw === true;
      continue;
    }
    const s = String(raw ?? "").trim();
    if (s === "") {
      body[f.name] = f.type === "text" || f.type === "sku" ? (f.required ? "" : undefined) : null;
      if (f.type === "textarea") body[f.name] = f.required ? "" : undefined;
      if (f.type === "select") body[f.name] = f.required ? "" : null;
      continue;
    }
    switch (f.type) {
      case "money":
        body[f.name] = parseShekel(s);
        break;
      case "bps":
        body[f.name] = parsePercentToBps(s);
        break;
      case "int":
        body[f.name] = Number(s);
        break;
      default:
        body[f.name] = s;
    }
  }
  return body;
}

export function CrudManager({ endpoint, fields, columns, rows, canEdit, createLabel, skuOptions, defaults, deletable = true, deleteLabel, emptyText, testId, allowCreate = true }: Props) {
  const t = useTranslations("common");
  const tp = useTranslations("admin.prices");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const { error, setError, run, pending } = useApi();
  const [editing, setEditing] = useState<CrudRow | "new" | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [marginConfirm, setMarginConfirm] = useState<{ issues: { sku: string; priceNet: number; minimumNet: number }[] } | null>(null);
  const listId = useMemo(() => `sku-${Math.random().toString(36).slice(2)}`, []);

  function open(row: CrudRow | "new") {
    setEditing(row);
    setValues(row === "new" ? { ...(defaults ?? {}) } : { ...row.values });
    setError(null);
    setMarginConfirm(null);
  }

  async function save(confirmBelowMargin = false) {
    let body: Record<string, unknown>;
    try {
      body = toBody(fields, values);
    } catch {
      setError(te("invalid_amount"));
      return;
    }
    if (confirmBelowMargin) body.confirmBelowMargin = true;
    setError(null);
    try {
      if (editing === "new") await apiFetch(endpoint, { body, locale });
      else if (editing) await apiFetch(`${endpoint}/${editing.id}`, { method: "PUT", body, locale });
      setEditing(null);
      setMarginConfirm(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.body.code === "below_margin") {
        setMarginConfirm((err.body.details as { issues: { sku: string; priceNet: number; minimumNet: number }[] }) ?? { issues: [] });
        return;
      }
      await run(() => Promise.reject(err));
    }
  }

  async function remove(row: CrudRow) {
    if (!window.confirm(t("confirmDelete"))) return;
    const ok = await run(() => apiFetch(`${endpoint}/${row.id}`, { method: "DELETE", locale }));
    if (ok) router.refresh();
  }

  const visible = (f: FieldDef) => !f.showIf || f.showIf.in.includes(String(values[f.showIf.field] ?? ""));

  return (
    <div className="space-y-4" data-testid={testId}>
      {canEdit && allowCreate ? (
        <div className="flex justify-end">
          <Button onClick={() => open("new")} data-testid="crud-new">{createLabel}</Button>
        </div>
      ) : null}
      {error && !editing ? <Alert tone="red">{error}</Alert> : null}

      {editing ? (
        <Card title={editing === "new" ? createLabel : t("edit")}>
          <form
            method="post"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {fields.filter(visible).map((f) => {
              const id = `f-${f.name}`;
              const v = values[f.name];
              const disabled = f.createOnly && editing !== "new";
              if (f.type === "checkbox") {
                return (
                  <label key={f.name} className="flex items-center gap-2 self-end pb-2 text-sm">
                    <input type="checkbox" checked={v === true} disabled={disabled} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} className="size-4 accent-brand-700" />
                    {f.label}
                  </label>
                );
              }
              return (
                <Field key={f.name} label={f.label} htmlFor={id} hint={f.hint}>
                  {f.type === "select" ? (
                    <Select id={id} value={String(v ?? "")} required={f.required} disabled={disabled} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                      {!f.required ? <option value="">–</option> : <option value="" disabled>–</option>}
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  ) : f.type === "textarea" ? (
                    <Textarea id={id} name={f.name} value={String(v ?? "")} required={f.required} disabled={disabled} dir={f.dir} rows={3} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
                  ) : (
                    <Input
                      id={id}
                      name={f.name}
                      value={String(v ?? "")}
                      required={f.required}
                      disabled={disabled}
                      list={f.type === "sku" ? listId : undefined}
                      type={f.type === "day" ? "date" : f.type === "datetime" ? "datetime-local" : f.type === "int" ? "number" : "text"}
                      inputMode={f.type === "money" || f.type === "bps" ? "decimal" : undefined}
                      dir={f.dir ?? (f.type === "text" ? undefined : "ltr")}
                      className={f.type === "text" ? undefined : "num"}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    />
                  )}
                </Field>
              );
            })}
            {skuOptions ? (
              <datalist id={listId}>
                {skuOptions.map((o) => (
                  <option key={o.sku} value={o.sku}>{o.label}</option>
                ))}
              </datalist>
            ) : null}
            <div className="space-y-3 sm:col-span-2 lg:col-span-3">
              {error ? <Alert tone="red">{error}</Alert> : null}
              {marginConfirm ? (
                <Alert tone="amber">
                  <p className="font-medium">{tp("belowMarginTitle")}</p>
                  <p>{tp("belowMarginText")}</p>
                  <div className="mt-2">
                    <Button type="button" variant="danger" size="sm" onClick={() => void save(true)} data-testid="confirm-below-margin">
                      {tp("confirmBelowMargin")}
                    </Button>
                  </div>
                </Alert>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={pending} data-testid="crud-save">{t("save")}</Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>{t("cancel")}</Button>
              </div>
            </div>
          </form>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-ink-500 ring-1 ring-ink-200">{emptyText ?? t("noResults")}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              {columns.map((c) => (
                <Th key={c.key}>{c.label}</Th>
              ))}
              {canEdit ? <Th /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => (
              <tr key={r.id} className={r.tone === "warn" ? "bg-amber-50" : r.tone === "muted" ? "text-ink-400" : undefined} data-testid="crud-row">
                {columns.map((c) => (
                  <Td key={c.key} className={c.className}>{r.cells[c.key] ?? ""}</Td>
                ))}
                {canEdit ? (
                  <Td>
                    <div className="flex gap-2 whitespace-nowrap">
                      <Button size="sm" variant="secondary" onClick={() => open(r)}>{t("edit")}</Button>
                      {deletable ? (
                        <Button size="sm" variant="danger" onClick={() => void remove(r)} disabled={pending}>{deleteLabel ?? t("delete")}</Button>
                      ) : null}
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
