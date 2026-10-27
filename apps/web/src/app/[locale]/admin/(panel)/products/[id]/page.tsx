import { hasPermission } from "@sa/core";
import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Forbidden } from "@/components/admin/Forbidden";
import { EditProductForm, ImageManager, VariantEditor } from "@/components/admin/ProductForms";
import { emptyVariant, type VariantValues } from "@/lib/product-variant";
import { Badge, Card, Num, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { money } from "@/server/format";
import { priceOptions } from "@/server/services/price-options";
import { getProductAdmin } from "@/server/services/products-admin";

export default async function ProductAdminPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "product.view");
  if (!auth) return <Forbidden />;
  const p = await getProductAdmin(id).catch(() => notFound());
  const [t, opts, units] = await Promise.all([getTranslations("admin.products"), priceOptions(locale), prisma.unitOfMeasure.findMany()]);
  const unitNames = Object.fromEntries(units.map((u) => [u.code, locale === "ar" ? u.nameAr : u.nameEn]));
  const canEdit = hasPermission(auth.permissions, "product.edit");
  const canPrice = hasPermission(auth.permissions, "price.edit");
  const code = (unitId: string) => units.find((u) => u.id === unitId)?.code ?? "PIECE";
  const toValues = (v: (typeof p.variants)[number]): VariantValues => ({
    sku: v.sku,
    barcode: v.barcode ?? "",
    nameAr: v.nameAr ?? "",
    nameEn: v.nameEn ?? "",
    minStock: String(v.minStock),
    defaultBinCode: v.defaultBin?.code ?? "",
    active: v.active,
    units: Object.fromEntries(v.units.map((u) => [u.unit.code, { factor: String(u.factor), barcode: u.barcode ?? "" }])),
    rules: Object.fromEntries(
      (["B2C", "B2B"] as const).map((ch) => {
        const r = v.channelRules.find((x) => x.channel === ch);
        return [ch, r ? { defaultUnitCode: code(r.defaultUnitId), allowed: r.allowedUnitIds.map(code), minQtyBase: String(r.minQtyBase), qtyStepBase: String(r.qtyStepBase) } : emptyVariant().rules[ch]];
      }),
    ) as VariantValues["rules"],
  });
  return (
    <div className="space-y-6">
      <PageHeader title={locale === "ar" ? p.nameAr : p.nameEn} subtitle={<Link href={`/products/${p.slug}`} className="text-brand-700 underline">{t("viewInShop")}</Link>} />
      {canEdit ? (
        <Card title={t("product")}>
          <EditProductForm
            id={p.id}
            categories={opts.categories}
            initial={{ slug: p.slug, nameAr: p.nameAr, nameEn: p.nameEn, descriptionAr: p.descriptionAr ?? "", descriptionEn: p.descriptionEn ?? "", categoryId: p.categoryId, brand: p.brand?.name ?? "", visibleB2C: p.visibleB2C, visibleB2B: p.visibleB2B, active: p.active }}
          />
        </Card>
      ) : null}
      <Card title={t("images")}>{canEdit ? <ImageManager productId={p.id} images={p.images.map((i) => ({ id: i.id, fileId: i.fileId }))} /> : null}</Card>
      {p.variants.map((v) => (
        <Card
          key={v.id}
          title={<span className="num">{v.sku}</span>}
          actions={
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {!v.active ? <Badge>{t("inactive")}</Badge> : null}
              <span>{t("stock")}: <Num>{v.stockLevels.reduce((a, s) => a + s.onHand, 0)}</Num> / {t("reserved")}: <Num>{v.stockLevels.reduce((a, s) => a + s.reserved, 0)}</Num></span>
              <span className="num">B2C {money(v.b2cPrice)} · B2B {money(v.b2bBasePrice)}</span>
              <Link href={`/admin/prices?q=${v.sku}`} className="text-brand-700 underline">{t("editPrices")}</Link>
            </div>
          }
        >
          {canEdit ? <VariantEditor productId={p.id} variantId={v.id} initial={toValues(v)} unitNames={unitNames} canPrice={canPrice} /> : null}
        </Card>
      ))}
      {canEdit ? (
        <Card title={t("addVariant")}>
          <VariantEditor productId={p.id} variantId={null} initial={emptyVariant()} unitNames={unitNames} canPrice={canPrice} />
        </Card>
      ) : null}
    </div>
  );
}
