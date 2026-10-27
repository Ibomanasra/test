"use client";

import { parseShekel } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { emptyVariant, type VariantValues } from "@/lib/product-variant";
import { useApi } from "@/lib/api-client";

const UNIT_CODES = ["PIECE", "PACK", "CARTON", "PALLET"] as const;

export interface ProductValues {
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  categoryId: string;
  brand: string;
  visibleB2C: boolean;
  visibleB2B: boolean;
  active: boolean;
}

function variantBody(v: VariantValues, withPrices: boolean) {
  return {
    sku: v.sku,
    barcode: v.barcode || null,
    nameAr: v.nameAr || undefined,
    nameEn: v.nameEn || undefined,
    minStock: Number(v.minStock) || 0,
    defaultBinCode: v.defaultBinCode || undefined,
    active: v.active,
    units: Object.entries(v.units).map(([unitCode, u]) => ({ unitCode, factor: Number(u.factor), barcode: u.barcode || null })),
    rules: (["B2C", "B2B"] as const).map((channel) => ({
      channel,
      defaultUnitCode: v.rules[channel].defaultUnitCode,
      allowedUnitCodes: v.rules[channel].allowed.filter((c) => v.units[c]),
      minQtyBase: Number(v.rules[channel].minQtyBase),
      qtyStepBase: Number(v.rules[channel].qtyStepBase),
    })),
    ...(withPrices
      ? {
          costPrice: v.costPrice ? parseShekel(v.costPrice) : 0,
          b2cPrice: v.b2cPrice ? parseShekel(v.b2cPrice) : 0,
          b2bBasePrice: v.b2bBasePrice ? parseShekel(v.b2bBasePrice) : 0,
        }
      : {}),
  };
}

function ProductFields({ v, set, categories }: { v: ProductValues; set: (p: Partial<ProductValues>) => void; categories: { value: string; label: string }[] }) {
  const t = useTranslations("admin.products");
  const tc = useTranslations("common");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("nameAr")} htmlFor="p-nameAr"><Input id="p-nameAr" dir="rtl" value={v.nameAr} onChange={(e) => set({ nameAr: e.target.value })} required minLength={2} /></Field>
      <Field label={t("nameEn")} htmlFor="p-nameEn"><Input id="p-nameEn" dir="ltr" value={v.nameEn} onChange={(e) => set({ nameEn: e.target.value })} required minLength={2} /></Field>
      <Field label={t("slug")} htmlFor="p-slug" hint={t("slugHint")}><Input id="p-slug" dir="ltr" className="num" value={v.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} required pattern="[a-z0-9][a-z0-9\-]{1,80}" /></Field>
      <Field label={t("category")} htmlFor="p-cat">
        <Select id="p-cat" value={v.categoryId} onChange={(e) => set({ categoryId: e.target.value })} required>
          <option value="" disabled>–</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </Field>
      <Field label={t("brand")} htmlFor="p-brand"><Input id="p-brand" value={v.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
      <div className="flex flex-wrap items-end gap-4 pb-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.visibleB2C} onChange={(e) => set({ visibleB2C: e.target.checked })} className="size-4 accent-brand-700" />{t("visibleB2C")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.visibleB2B} onChange={(e) => set({ visibleB2B: e.target.checked })} className="size-4 accent-brand-700" />{t("visibleB2B")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.active} onChange={(e) => set({ active: e.target.checked })} className="size-4 accent-brand-700" />{tc("active")}</label>
      </div>
      <Field label={t("descriptionAr")} htmlFor="p-dAr"><Textarea id="p-dAr" dir="rtl" value={v.descriptionAr} onChange={(e) => set({ descriptionAr: e.target.value })} /></Field>
      <Field label={t("descriptionEn")} htmlFor="p-dEn"><Textarea id="p-dEn" dir="ltr" value={v.descriptionEn} onChange={(e) => set({ descriptionEn: e.target.value })} /></Field>
    </div>
  );
}

function VariantFields({ v, set, withPrices, unitNames }: { v: VariantValues; set: (p: Partial<VariantValues>) => void; withPrices: boolean; unitNames: Record<string, string> }) {
  const t = useTranslations("admin.products");
  const tp = useTranslations("admin.prices");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const setUnit = (code: string, patch: Partial<{ factor: string; barcode: string }> | null) => {
    const units = { ...v.units };
    if (patch === null) delete units[code];
    else units[code] = { ...(units[code] ?? { factor: "1", barcode: "" }), ...patch };
    set({ units });
  };
  const setRule = (ch: "B2C" | "B2B", patch: Partial<VariantValues["rules"]["B2C"]>) => set({ rules: { ...v.rules, [ch]: { ...v.rules[ch], ...patch } } });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="SKU" htmlFor="v-sku"><Input id="v-sku" dir="ltr" className="num" value={v.sku} onChange={(e) => set({ sku: e.target.value })} required /></Field>
        <Field label={t("barcode")} htmlFor="v-bc" hint={t("barcodeHint")}><Input id="v-bc" dir="ltr" className="num" value={v.barcode} onChange={(e) => set({ barcode: e.target.value })} /></Field>
        <Field label={t("bin")} htmlFor="v-bin"><Input id="v-bin" dir="ltr" className="num" value={v.defaultBinCode} onChange={(e) => set({ defaultBinCode: e.target.value })} placeholder="A-01-1" /></Field>
        <Field label={t("variantNameAr")} htmlFor="v-nAr"><Input id="v-nAr" dir="rtl" value={v.nameAr} onChange={(e) => set({ nameAr: e.target.value })} /></Field>
        <Field label={t("variantNameEn")} htmlFor="v-nEn"><Input id="v-nEn" dir="ltr" value={v.nameEn} onChange={(e) => set({ nameEn: e.target.value })} /></Field>
        <Field label={t("minStock")} htmlFor="v-min"><Input id="v-min" type="number" min={0} dir="ltr" className="num" value={v.minStock} onChange={(e) => set({ minStock: e.target.value })} /></Field>
      </div>
      {withPrices ? (
        <div className="grid gap-4 rounded-lg bg-ink-50 p-3 sm:grid-cols-3">
          <Field label={tp("cost")} htmlFor="v-cost"><Input id="v-cost" dir="ltr" className="num" value={v.costPrice} onChange={(e) => set({ costPrice: e.target.value })} /></Field>
          <Field label={tp("b2c")} htmlFor="v-b2c"><Input id="v-b2c" dir="ltr" className="num" value={v.b2cPrice} onChange={(e) => set({ b2cPrice: e.target.value })} /></Field>
          <Field label={tp("b2b")} htmlFor="v-b2b"><Input id="v-b2b" dir="ltr" className="num" value={v.b2bBasePrice} onChange={(e) => set({ b2bBasePrice: e.target.value })} /></Field>
        </div>
      ) : null}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("units")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {UNIT_CODES.map((code) => {
            const u = v.units[code];
            return (
              <div key={code} className="flex flex-wrap items-center gap-2 rounded-lg p-2 ring-1 ring-ink-200">
                <label className="flex w-28 items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!u} disabled={code === "PIECE"} onChange={(e) => setUnit(code, e.target.checked ? { factor: "12" } : null)} className="accent-brand-700" />
                  {unitNames[code] ?? code}
                </label>
                {u ? (
                  <>
                    <Input aria-label={t("factor")} type="number" min={1} dir="ltr" className="num w-20 py-1.5" value={u.factor} disabled={code === "PIECE"} onChange={(e) => setUnit(code, { factor: e.target.value })} />
                    <Input aria-label={t("barcode")} dir="ltr" className="num w-40 py-1.5" placeholder={t("barcode")} value={u.barcode} onChange={(e) => setUnit(code, { barcode: e.target.value })} />
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["B2C", "B2B"] as const).map((ch) => (
          <fieldset key={ch} className="space-y-2 rounded-lg p-3 ring-1 ring-ink-200">
            <legend className="px-1 text-sm font-semibold">{tAll(`channel.${ch}`)}</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.keys(v.units).map((code) => (
                <label key={code} className="flex items-center gap-1">
                  <input type="checkbox" checked={v.rules[ch].allowed.includes(code)} onChange={(e) => setRule(ch, { allowed: e.target.checked ? [...v.rules[ch].allowed, code] : v.rules[ch].allowed.filter((x) => x !== code) })} className="accent-brand-700" />
                  {unitNames[code] ?? code}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label={t("defaultUnit")} htmlFor={`r-${ch}-d`}>
                <Select id={`r-${ch}-d`} value={v.rules[ch].defaultUnitCode} onChange={(e) => setRule(ch, { defaultUnitCode: e.target.value })}>
                  {v.rules[ch].allowed.map((c) => <option key={c} value={c}>{unitNames[c] ?? c}</option>)}
                </Select>
              </Field>
              <Field label={t("minQtyBase")} htmlFor={`r-${ch}-m`}><Input id={`r-${ch}-m`} type="number" min={1} dir="ltr" className="num" value={v.rules[ch].minQtyBase} onChange={(e) => setRule(ch, { minQtyBase: e.target.value })} /></Field>
              <Field label={t("stepBase")} htmlFor={`r-${ch}-s`}><Input id={`r-${ch}-s`} type="number" min={1} dir="ltr" className="num" value={v.rules[ch].qtyStepBase} onChange={(e) => setRule(ch, { qtyStepBase: e.target.value })} /></Field>
            </div>
          </fieldset>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.active} onChange={(e) => set({ active: e.target.checked })} className="size-4 accent-brand-700" />{tc("active")}</label>
    </div>
  );
}

export function NewProductForm({ categories, unitNames, canPrice }: { categories: { value: string; label: string }[]; unitNames: Record<string, string>; canPrice: boolean }) {
  const t = useTranslations("admin.products");
  const te = useTranslations("errors");
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const [p, setP] = useState<ProductValues>({ slug: "", nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", categoryId: "", brand: "", visibleB2C: true, visibleB2B: true, active: true });
  const [v, setV] = useState<VariantValues>(emptyVariant());
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let variant;
    try {
      variant = variantBody(v, canPrice);
    } catch {
      return setError(te("invalid_amount"));
    }
    const res = await call<{ id: string }>("/api/v1/admin/products", { body: { product: { ...p, brand: p.brand || undefined, descriptionAr: p.descriptionAr || undefined, descriptionEn: p.descriptionEn || undefined }, variant } });
    if (res) router.push(`/admin/products/${res.id}`);
  }
  return (
    <form method="post" onSubmit={submit} className="space-y-6">
      <Card title={t("product")}><ProductFields v={p} set={(x) => setP({ ...p, ...x })} categories={categories} /></Card>
      <Card title={t("firstVariant")}><VariantFields v={v} set={(x) => setV({ ...v, ...x })} withPrices={canPrice} unitNames={unitNames} /></Card>
      {!canPrice ? <Alert tone="blue">{t("noPriceRight")}</Alert> : null}
      {error ? <Alert tone="red">{error}</Alert> : null}
      <Button type="submit" disabled={pending} data-testid="create-product">{t("create")}</Button>
    </form>
  );
}

export function EditProductForm({ id, initial, categories }: { id: string; initial: ProductValues; categories: { value: string; label: string }[] }) {
  const tc = useTranslations("common");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [p, setP] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <form
      method="post"
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        if (await call(`/api/v1/admin/products/${id}`, { method: "PUT", body: { ...p, brand: p.brand || undefined, descriptionAr: p.descriptionAr || undefined, descriptionEn: p.descriptionEn || undefined } })) {
          setSaved(true);
          router.refresh();
        }
      }}
    >
      <ProductFields v={p} set={(x) => setP({ ...p, ...x })} categories={categories} />
      {error ? <Alert tone="red">{error}</Alert> : null}
      {saved ? <Alert tone="green">{tc("saved")}</Alert> : null}
      <Button type="submit" disabled={pending}>{tc("save")}</Button>
    </form>
  );
}

export function VariantEditor({ productId, variantId, initial, unitNames, canPrice }: { productId: string; variantId: string | null; initial: VariantValues; unitNames: Record<string, string>; canPrice: boolean }) {
  const t = useTranslations("admin.products");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const [open, setOpen] = useState(!variantId);
  const [v, setV] = useState(initial);
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{tc("edit")}</Button>;
  return (
    <form
      method="post"
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        let body;
        try {
          body = variantBody(v, !variantId && canPrice);
        } catch {
          return setError(te("invalid_amount"));
        }
        const res = await call(variantId ? `/api/v1/admin/products/${productId}/variants/${variantId}` : `/api/v1/admin/products/${productId}/variants`, { method: variantId ? "PUT" : "POST", body, locale });
        if (res) {
          if (variantId) setOpen(false);
          else setV(emptyVariant());
          router.refresh();
        }
      }}
    >
      <VariantFields v={v} set={(x) => setV({ ...v, ...x })} withPrices={!variantId && canPrice} unitNames={unitNames} />
      {error ? <Alert tone="red">{error}</Alert> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{variantId ? tc("save") : t("addVariant")}</Button>
        {variantId ? <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button> : null}
      </div>
    </form>
  );
}

export function ImageManager({ productId, images }: { productId: string; images: { id: string; fileId: string }[] }) {
  const t = useTranslations("admin.products");
  const tc = useTranslations("common");
  const router = useRouter();
  const { call, pending, error } = useApi();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {images.map((img) => (
          <div key={img.id} className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/v1/images/${img.fileId}`} alt="" className="aspect-square w-full rounded-lg object-contain ring-1 ring-ink-200" />
            <Button size="sm" variant="ghost" disabled={pending} onClick={async () => { if (await call(`/api/v1/admin/products/${productId}/images/${img.id}`, { method: "DELETE" })) router.refresh(); }}>{tc("delete")}</Button>
          </div>
        ))}
      </div>
      <Field label={t("uploadImage")} htmlFor="img-up">
        <Input id="img-up" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const fd = new FormData();
          fd.set("file", f);
          if (await call(`/api/v1/admin/products/${productId}/images`, { form: fd })) router.refresh();
          e.target.value = "";
        }} />
      </Field>
      {error ? <Alert tone="red">{error}</Alert> : null}
    </div>
  );
}
