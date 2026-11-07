"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

interface Company {
  id: string;
  name: string;
  phone: string;
  note: string;
  active: boolean;
  /** Lieferscheine gerade bei der Firma (unterwegs) */
  open: number;
}

const EMPTY = { name: "", phone: "", note: "" };

/** Einstellungen → Zustellfirmen: anlegen, bearbeiten, deaktivieren */
export function DeliveryCompaniesManager({ items, canEdit, ownDrivers }: { items: Company[]; canEdit: boolean; ownDrivers: boolean }) {
  const t = useTranslations("admin.companies");
  const tc = useTranslations("common");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [editing, setEditing] = useState<string | "new" | null>(items.length ? null : "new");
  const [form, setForm] = useState(EMPTY);

  const start = (c?: Company) => {
    setEditing(c ? c.id : "new");
    setForm(c ? { name: c.name, phone: c.phone, note: c.note } : EMPTY);
  };
  const save = async (c?: Company, patch?: Partial<Company>) => {
    const body = { name: patch?.name ?? form.name, phone: (patch ? c?.phone : form.phone) || undefined, note: (patch ? c?.note : form.note) || undefined, active: patch?.active ?? c?.active ?? true };
    const path = c ? `/api/v1/admin/delivery-companies/${c.id}` : "/api/v1/admin/delivery-companies";
    if (await call(path, { method: c ? "PATCH" : "POST", body })) {
      setEditing(null);
      setForm(EMPTY);
      router.refresh();
    }
  };

  const editor = (c?: Company) => (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save(c);
      }}
    >
      <Field label={t("name")} htmlFor="dc-name"><Input id="dc-name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("namePlaceholder")} data-testid="dc-name" /></Field>
      <Field label={t("phone")} htmlFor="dc-phone"><Input id="dc-phone" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
      <Field label={t("note")} htmlFor="dc-note"><Input id="dc-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" disabled={pending} data-testid="dc-save">{tc("save")}</Button>
        {items.length ? <Button type="button" variant="secondary" onClick={() => setEditing(null)}>{tc("cancel")}</Button> : null}
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <Alert tone="blue">{t("intro")}</Alert>
      {error ? <Alert tone="red">{error}</Alert> : null}
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} data-testid="dc-row">
            <Card>
              {editing === c.id ? editor(c) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">🚚 {c.name} {!c.active ? <Badge>{t("inactive")}</Badge> : null}</p>
                    <p className="text-sm text-ink-500">{[c.phone, c.note].filter(Boolean).join(" · ") || "–"}</p>
                  </div>
                  {c.open ? <Badge tone="brand">{t("open", { count: c.open })}</Badge> : null}
                  {canEdit ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => start(c)}>{tc("edit")}</Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => void save(c, { active: !c.active, name: c.name })}>{c.active ? t("deactivate") : t("activate")}</Button>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <Card>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={ownDrivers}
              disabled={pending}
              onChange={async (e) => {
                if (await call("/api/v1/admin/settings/own-drivers", { method: "PUT", body: { enabled: e.target.checked } })) router.refresh();
              }}
              className="mt-1 size-5 accent-brand-700"
              data-testid="own-drivers"
            />
            <span>
              <span className="block font-medium text-ink-900">{t("ownDrivers")}</span>
              <span className="block text-sm text-ink-500">{t("ownDriversHint")}</span>
            </span>
          </label>
        </Card>
      ) : null}
      {canEdit ? (
        editing === "new" ? <Card title={t("new")}>{editor()}</Card> : <Button onClick={() => start()} data-testid="dc-new">＋ {t("new")}</Button>
      ) : null}
    </div>
  );
}
