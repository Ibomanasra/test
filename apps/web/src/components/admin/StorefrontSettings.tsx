"use client";

import { useTranslations } from "next-intl";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export interface StorefrontValues {
  heroTitleAr: string;
  heroTitleEn: string;
  heroTextAr: string;
  heroTextEn: string;
  imageFileId: string | null;
}

/** Einstellungen → Startseite: Überschrift, Text, Hintergrundbild */
export function StorefrontSettings({ v, canEdit, defaults }: { v: StorefrontValues; canEdit: boolean; defaults: { titleAr: string; textAr: string } }) {
  const t = useTranslations("admin.settings.storefront");
  const tc = useTranslations("common");
  const router = useRouter();
  const { call, pending, error } = useApi();

  async function saveText(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(["heroTitleAr", "heroTitleEn", "heroTextAr", "heroTextEn"].map((k) => [k, String(fd.get(k) ?? "")]));
    if (await call("/api/v1/admin/settings/storefront", { method: "PUT", body })) router.refresh();
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    if (await call("/api/v1/admin/settings/storefront/image", { form: fd })) router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card title={t("imageTitle")}>
        <p className="mb-3 text-sm text-ink-600">{t("imageHint")}</p>
        {v.imageFileId ? (
          // eslint-disable-next-line @next/next/no-img-element -- Vorschau des hochgeladenen Bildes
          <img src={`/api/v1/images/${v.imageFileId}`} alt="" className="mb-3 aspect-[3/1] w-full rounded-xl object-cover ring-1 ring-ink-200" />
        ) : (
          <p className="mb-3 rounded-xl bg-ink-50 p-4 text-sm text-ink-600">{t("noImage")}</p>
        )}
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
              {v.imageFileId ? t("replace") : t("upload")}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} data-testid="hero-upload" />
            </label>
            {v.imageFileId ? <Button variant="secondary" disabled={pending} onClick={async () => { if (await call("/api/v1/admin/settings/storefront/image", { method: "DELETE" })) router.refresh(); }}>{t("remove")}</Button> : null}
          </div>
        ) : null}
      </Card>

      <Card title={t("textTitle")}>
        <form onSubmit={saveText} className="grid gap-4 sm:grid-cols-2">
          <Field label={t("titleAr")} htmlFor="h-tar"><Input id="h-tar" name="heroTitleAr" dir="rtl" defaultValue={v.heroTitleAr} placeholder={defaults.titleAr} disabled={!canEdit} /></Field>
          <Field label={t("titleEn")} htmlFor="h-ten"><Input id="h-ten" name="heroTitleEn" dir="ltr" defaultValue={v.heroTitleEn} disabled={!canEdit} /></Field>
          <Field label={t("textAr")} htmlFor="h-xar"><Textarea id="h-xar" name="heroTextAr" dir="rtl" rows={3} defaultValue={v.heroTextAr} placeholder={defaults.textAr} disabled={!canEdit} /></Field>
          <Field label={t("textEn")} htmlFor="h-xen"><Textarea id="h-xen" name="heroTextEn" dir="ltr" rows={3} defaultValue={v.heroTextEn} disabled={!canEdit} /></Field>
          <p className="text-xs text-ink-500 sm:col-span-2">{t("emptyDefault")}</p>
          {error ? <div className="sm:col-span-2"><Alert tone="red">{error}</Alert></div> : null}
          {canEdit ? <div className="flex gap-3 sm:col-span-2"><Button type="submit" disabled={pending}>{tc("save")}</Button><a href="/ar" target="_blank" rel="noopener" className="self-center text-sm text-brand-700 underline">{t("preview")}</a></div> : null}
        </form>
      </Card>
    </div>
  );
}
