"use client";

import { parseShekel } from "@sa/core";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { Alert, Button, Card, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

const NEW = "__new__";

/**
 * Produkt in einem Schritt: Fotos, Name, Kategorie (auch neu), Preise, Karton, Bestand.
 * Artikelnummer, Link und Einheiten-Regeln setzt der Server automatisch.
 */
export function QuickProductForm({ categories, canSeeCost, canStock }: { categories: { value: string; label: string }[]; canSeeCost: boolean; canStock: boolean }) {
  const t = useTranslations("admin.products.quick");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const formRef = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(categories[0]?.value ?? NEW);
  const [carton, setCarton] = useState(false);
  const [done, setDone] = useState<{ id: string; sku: string; name: string } | null>(null);

  // Vorschau-URLs je Dateiliste; alte beim Wechsel freigeben
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const imgs = [...list].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    setFiles((prev) => [...prev, ...imgs].slice(0, 8));
  }

  const money = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    return String(parseShekel(s));
  };

  async function submit(e: React.FormEvent<HTMLFormElement>, again: boolean) {
    e.preventDefault();
    const src = new FormData(e.currentTarget);
    const fd = new FormData();
    try {
      fd.set("b2cPrice", money(src.get("b2cPrice")));
      fd.set("b2bPrice", money(src.get("b2bPrice")));
      fd.set("costPrice", money(src.get("costPrice")));
    } catch {
      return setError(te("invalid_amount"));
    }
    for (const k of ["nameAr", "nameEn", "barcode", "descriptionAr", "stockQty"]) fd.set(k, String(src.get(k) ?? ""));
    if (category === NEW) fd.set("newCategoryAr", String(src.get("newCategoryAr") ?? ""));
    else fd.set("categoryId", category);
    fd.set("cartonSize", carton ? String(src.get("cartonSize") ?? "") : "");
    for (const f of files) fd.append("images", f);
    const res = await call<{ id: string; sku: string }>("/api/v1/admin/products/quick", { form: fd });
    if (!res) return;
    if (again) {
      setDone({ ...res, name: String(src.get("nameAr")) });
      formRef.current?.reset();
      setFiles([]);
      setCarton(false);
      router.refresh();
      formRef.current?.querySelector<HTMLInputElement>("#q-name")?.focus();
    } else {
      router.push(`/admin/products/${res.id}`);
    }
  }

  return (
    <form ref={formRef} onSubmit={(e) => void submit(e, (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "again")} className="grid gap-6 lg:grid-cols-3" data-testid="quick-product">
      {done ? (
        <div className="lg:col-span-3">
          <Alert tone="green">
            {t("saved", { name: done.name, sku: done.sku })} <Link href={`/admin/products/${done.id}`} className="underline">{t("open")}</Link>
          </Alert>
        </div>
      ) : null}

      {/* Fotos */}
      <Card title={t("photos")} className="lg:order-2">
        <label
          className="relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 p-6 text-center text-sm text-ink-600 hover:border-brand-400 hover:bg-brand-50/40"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <Icon name="plus" className="size-8 text-ink-400" />
          <span className="font-medium">{t("addPhotos")}</span>
          <span className="text-xs text-ink-500">{t("photosHint")}</span>
          {/* ohne capture: Handy zeigt Galerie (und je nach Gerät auch Kamera) zur Auswahl */}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} data-testid="q-photos" />
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ring-1 ring-ink-300 hover:bg-ink-50">
            🖼️ {t("fromGallery")}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} data-testid="q-photos-gallery" />
          </label>
          <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ring-1 ring-ink-300 hover:bg-ink-50">
            📷 {t("takePhoto")}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} data-testid="q-photos-camera" />
          </label>
        </div>
        {previews.length ? (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <li key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- lokale Vorschau (blob:) */}
                <img src={src} alt="" className={cn("aspect-square w-full rounded-lg object-cover ring-1", i === 0 ? "ring-2 ring-brand-500" : "ring-ink-200")} />
                {i === 0 ? <span className="absolute start-1 top-1 rounded bg-brand-700 px-1.5 text-[10px] font-semibold text-white">{t("main")}</span> : null}
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-white/90 text-ink-700 shadow" aria-label={tc("delete")}>×</button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <div className="space-y-6 lg:order-1 lg:col-span-2">
        <Card title={t("basics")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("name")} htmlFor="q-name" className="sm:col-span-2">
              <Input id="q-name" name="nameAr" required minLength={2} placeholder={t("namePlaceholder")} className="text-lg" autoFocus />
            </Field>
            <Field label={t("category")} htmlFor="q-cat">
              <Select id="q-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                <option value={NEW}>＋ {t("newCategory")}</option>
              </Select>
            </Field>
            {category === NEW ? (
              <Field label={t("newCategoryName")} htmlFor="q-newcat">
                <Input id="q-newcat" name="newCategoryAr" required minLength={2} placeholder={t("newCategoryPlaceholder")} />
              </Field>
            ) : <div />}
          </div>
        </Card>

        <Card title={t("prices")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("b2c")} htmlFor="q-b2c" hint={t("b2cHint")}>
              <Input id="q-b2c" name="b2cPrice" inputMode="decimal" dir="ltr" className="num text-lg font-semibold" required placeholder="0.00" />
            </Field>
            <Field label={t("b2b")} htmlFor="q-b2b" hint={t("b2bHint")}>
              <Input id="q-b2b" name="b2bPrice" inputMode="decimal" dir="ltr" className="num" placeholder="0.00" />
            </Field>
            {canSeeCost ? (
              <Field label={t("cost")} htmlFor="q-cost" hint={t("costHint")}>
                <Input id="q-cost" name="costPrice" inputMode="decimal" dir="ltr" className="num" placeholder="0.00" />
              </Field>
            ) : null}
          </div>
        </Card>

        <Card title={t("stockAndUnits")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {canStock ? (
              <Field label={t("stock")} htmlFor="q-stock" hint={t("stockHint")}>
                <Input id="q-stock" name="stockQty" inputMode="numeric" dir="ltr" className="num" placeholder="0" />
              </Field>
            ) : null}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
                <input type="checkbox" checked={carton} onChange={(e) => setCarton(e.target.checked)} className="size-4 accent-brand-700" /> {t("carton")}
              </label>
              {carton ? (
                <Input name="cartonSize" inputMode="numeric" dir="ltr" className="num" placeholder="12" required aria-label={t("cartonSize")} />
              ) : (
                <p className="text-xs text-ink-500">{t("cartonHint")}</p>
              )}
            </div>
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-ink-600">{t("more")}</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label={t("nameEn")} htmlFor="q-en"><Input id="q-en" name="nameEn" dir="ltr" className="text-start" /></Field>
              <Field label={t("barcode")} htmlFor="q-bc"><Input id="q-bc" name="barcode" dir="ltr" inputMode="numeric" className="num" /></Field>
              <Field label={t("description")} htmlFor="q-desc" className="sm:col-span-2"><Textarea id="q-desc" name="descriptionAr" rows={3} /></Field>
            </div>
          </details>
        </Card>

        {error ? <Alert tone="red">{error}</Alert> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" value="open" disabled={pending} data-testid="q-save">{pending ? "…" : t("save")}</Button>
          <Button type="submit" value="again" variant="secondary" disabled={pending} data-testid="q-save-again">{t("saveAndNew")}</Button>
          <Link href="/admin/products/new?advanced=1" className="ms-auto text-sm text-ink-500 hover:text-ink-900">{t("advanced")}</Link>
        </div>
      </div>
    </form>
  );
}
