"use client";

import { useLocale } from "next-intl";
import { useState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { toBody, type FieldDef } from "./CrudManager";

/**
 * Kleines Formular → API-Aufruf (für Aktionen wie Bestandskorrektur, Zahlung, Mahnlauf).
 * Nach Erfolg: Seite aktualisieren oder weiterleiten (`redirect` mit {id}).
 */
export function ApiForm({
  endpoint,
  method = "POST",
  fields,
  submitLabel,
  defaults = {},
  extra = {},
  redirect,
  successText,
  confirmText,
  testId,
  columns = 3,
}: {
  endpoint: string;
  method?: "POST" | "PUT";
  fields: FieldDef[];
  submitLabel: string;
  defaults?: Record<string, string | boolean>;
  /** feste Zusatzwerte im Request */
  extra?: Record<string, unknown>;
  redirect?: string;
  successText?: string;
  confirmText?: string;
  testId?: string;
  columns?: 1 | 2 | 3;
}) {
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [values, setValues] = useState<Record<string, string | boolean>>(defaults);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmText && !window.confirm(confirmText)) return;
    setOk(null);
    let body: Record<string, unknown>;
    try {
      body = { ...toBody(fields, values), ...extra };
    } catch {
      return;
    }
    const res = await call<{ id?: string; number?: string }>(endpoint, { method, body, locale });
    if (res) {
      if (redirect && res.id) router.push(redirect.replace("{id}", res.id));
      else {
        setValues(defaults);
        setOk(successText ? successText.replace("{number}", res.number ?? "") : "✓");
        router.refresh();
      }
    }
  }

  const grid = columns === 1 ? "" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <form method="post" onSubmit={submit} className="space-y-3" data-testid={testId}>
      <div className={`grid gap-3 ${grid}`}>
        {fields.map((f) => {
          const id = `${testId ?? "f"}-${f.name}`;
          const v = values[f.name];
          if (f.showIf && !f.showIf.in.includes(String(values[f.showIf.field] ?? ""))) return null;
          if (f.type === "checkbox") {
            return (
              <label key={f.name} className="flex items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={v === true} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} className="size-4 accent-brand-700" />
                {f.label}
              </label>
            );
          }
          return (
            <Field key={f.name} label={f.label} htmlFor={id} hint={f.hint}>
              {f.type === "select" ? (
                <Select id={id} value={String(v ?? "")} required={f.required} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                  <option value="" disabled={f.required}>–</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea id={id} value={String(v ?? "")} required={f.required} dir={f.dir} rows={3} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              ) : (
                <Input
                  id={id}
                  value={String(v ?? "")}
                  required={f.required}
                  type={f.type === "day" ? "date" : f.type === "int" ? "number" : "text"}
                  inputMode={f.type === "money" || f.type === "bps" ? "decimal" : undefined}
                  dir={f.dir ?? (f.type === "text" ? undefined : "ltr")}
                  className={f.type === "text" ? undefined : "num"}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                />
              )}
            </Field>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} data-testid={testId ? `${testId}-submit` : undefined}>{submitLabel}</Button>
        {ok ? <span className="text-sm text-green-700" role="status">{ok}</span> : null}
      </div>
      {error ? <Alert tone="red">{error}</Alert> : null}
    </form>
  );
}

/** Ein Knopf → POST (optional mit Rückfrage und Begründung) */
export function ApiButton({
  endpoint,
  body = {},
  label,
  confirmText,
  promptText,
  promptField = "reason",
  variant = "secondary",
  size = "sm",
  testId,
  redirect,
  method = "POST",
}: {
  endpoint: string;
  body?: Record<string, unknown>;
  label: string;
  confirmText?: string;
  /** fragt einen Text ab (z. B. Grund) und sendet ihn als `promptField` */
  promptText?: string;
  promptField?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  testId?: string;
  redirect?: string;
  method?: "POST" | "PUT" | "DELETE";
}) {
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error } = useApi();
  async function go() {
    let extra: Record<string, unknown> = {};
    if (promptText) {
      const v = window.prompt(promptText);
      if (!v) return;
      extra = { [promptField]: v };
    } else if (confirmText && !window.confirm(confirmText)) return;
    const res = await call<{ id?: string }>(endpoint, { method, body: method === "DELETE" ? undefined : { ...body, ...extra }, locale });
    if (res) {
      if (redirect) router.push(redirect.replace("{id}", res.id ?? ""));
      else router.refresh();
    }
  }
  return (
    <span className="inline-flex flex-col">
      <Button type="button" variant={variant} size={size} disabled={pending} onClick={() => void go()} data-testid={testId}>{label}</Button>
      {error ? <span className="mt-1 text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
