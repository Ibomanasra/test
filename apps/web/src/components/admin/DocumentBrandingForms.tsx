"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { useHydrated } from "@/lib/use-hydrated";

export function LogoForm({ logoFileId, canEdit }: { logoFileId: string | null; canEdit: boolean }) {
  const t = useTranslations("admin.settings.docs");
  const router = useRouter();
  const hydrated = useHydrated();
  const { call, pending, error } = useApi();

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (await call("/api/v1/admin/settings/logo", { form })) router.refresh();
  }

  return (
    <Card title={t("logo")}>
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex h-20 w-40 items-center justify-center rounded-lg bg-ink-50 ring-1 ring-ink-200">
          {/* eslint-disable-next-line @next/next/no-img-element -- privates Bild über geschützten Endpunkt */}
          {logoFileId ? <img src={`/api/v1/files/${logoFileId}`} alt={t("logo")} className="max-h-16 max-w-36 object-contain" /> : <span className="text-xs text-ink-500">{t("noLogo")}</span>}
        </div>
        {canEdit ? (
          <form method="post" onSubmit={upload} className="flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required className="text-sm" />
            <Button type="submit" size="sm" disabled={pending || !hydrated}>{t("upload")}</Button>
            {logoFileId ? (
              <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={async () => { if (await call("/api/v1/admin/settings/logo", { method: "DELETE" })) router.refresh(); }}>
                {t("removeLogo")}
              </Button>
            ) : null}
          </form>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-ink-500">{t("logoHint")}</p>
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
    </Card>
  );
}

export function TaxInvoiceForm({ notesAr, notesEn, canEdit }: { notesAr: string; notesEn: string; canEdit: boolean }) {
  const t = useTranslations("admin.settings.docs");
  const tc = useTranslations("common");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [ar, setAr] = useState(notesAr);
  const [en, setEn] = useState(notesEn);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/api/v1/admin/settings/tax-invoice", { method: "PUT", body: { notesAr: ar, notesEn: en } })) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <Card title={t("taxInvoice")}>
      <Alert tone="amber">{t("taxAdvisor")}</Alert>
      <form method="post" onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={t("invoiceNotesAr")} htmlFor="ti-ar"><Textarea id="ti-ar" dir="rtl" value={ar} onChange={(e) => { setAr(e.target.value); setSaved(false); }} disabled={!canEdit} rows={3} /></Field>
        <Field label={t("invoiceNotesEn")} htmlFor="ti-en"><Textarea id="ti-en" dir="ltr" value={en} onChange={(e) => { setEn(e.target.value); setSaved(false); }} disabled={!canEdit} rows={3} /></Field>
        {canEdit ? (
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={pending}>{tc("save")}</Button>
            {saved ? <span className="text-sm text-green-700">{tc("saved")}</span> : null}
          </div>
        ) : null}
      </form>
      {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
    </Card>
  );
}
