import { hasPermission } from "@sa/core";
import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Forbidden } from "@/components/admin/Forbidden";
import { EditProductForm, ImageManager, VariantEditor } from "@/components/admin/ProductForms";
import { emptyVariant, type VariantValues } from "@/lib/product-variant";
import { Icon } from "@/components/admin/Icon";
import { PriceStockCard } from "@/components/admin/PriceStockCard";
import { ActiveSwitch, DeleteProductButton } from "@/components/admin/ProductActions";
import { Badge, Card } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day } from "@/server/format";
import { priceOptions } from "@/server/services/price-options";
import { getProductAdmin } from "@/server/services/products-admin";

export default async function ProductAdminPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "product.view");
  if (!auth) return <Forbidden />;
  const p = await getProductAdmin(id).catch(() => notFound());
  const [t, tc, opts, units] = await Promise.all([getTranslations("admin.products"), getTranslations("common"), priceOptions(locale), prisma.unitOfMeasure.findMany()]);
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
  const now = new Date();
  const promos = await prisma.promotion.findMany({
    where: { endsAt: { gt: now }, targets: { some: { OR: [{ variantId: { in: p.variants.map((v) => v.id) } }, { productId: p.id }, { categoryId: p.categoryId }] } } },
    orderBy: { startsAt: "asc" },
  });
  const can = (x: Parameters<typeof hasPermission>[1]) => hasPermission(auth.permissions, x);
  const name = locale === "ar" ? p.nameAr : p.nameEn;
  const firstSku = p.variants[0]?.sku ?? "";
  const tm = await getTranslations("admin.products.manage");

  return (
    <div className="space-y-6">
      {/* Kopf: Bild, Name, Sichtbarkeit, Löschen */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- Produktfoto
          <img src={`/api/v1/images/${p.images[0].fileId}`} alt="" className="size-20 rounded-xl object-cover ring-1 ring-ink-200" />
        ) : (
          <span className="grid size-20 place-items-center rounded-xl bg-ink-100 text-ink-400"><Icon name="box" className="size-8" /></span>
        )}
        <div className="min-w-48 flex-1">
          <h1 className="text-xl font-bold text-ink-900">{name}</h1>
          <p className="text-sm text-ink-500"><span className="num">{p.variants.map((v) => v.sku).join(", ")}</span> · {opts.categoryName.get(p.categoryId) ?? ""}</p>
          <Link href={`/products/${p.slug}`} className="text-sm text-brand-700 underline">{t("viewInShop")}</Link>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-3">
            {p.archivedAt ? <Badge>{tm("archived")}</Badge> : <ActiveSwitch productId={p.id} active={p.active} label />}
            {p.archivedAt ? null : <DeleteProductButton productId={p.id} name={name} after="list" />}
          </div>
        ) : null}
      </div>

      {/* 1. Preis & Bestand */}
      <PriceStockCard
        canPrice={can("price.edit")}
        canStock={can("stock.adjust")}
        canSeeCost={can("price.view_cost")}
        canConfirmBelow={can("price.confirm_below_margin")}
        variants={p.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          label: (locale === "ar" ? v.nameAr : v.nameEn) ?? null,
          b2cPrice: v.b2cPrice,
          b2bBasePrice: v.b2bBasePrice,
          costPrice: can("price.view_cost") ? v.costPrice : null,
          available: v.stockLevels.reduce((a, s) => a + s.onHand - s.reserved, 0),
          reserved: v.stockLevels.reduce((a, s) => a + s.reserved, 0),
          cartonFactor: v.units.find((u) => u.unit.code === "CARTON")?.factor ?? null,
        }))}
      />

      {/* 2. Fotos */}
      <Card title={t("images")}>{canEdit ? <ImageManager productId={p.id} images={p.images.map((i) => ({ id: i.id, fileId: i.fileId }))} /> : null}</Card>

      {/* 3. Angebote für dieses Produkt */}
      <Card
        title={tm("offers")}
        actions={can("price.promotions") ? <Link href={`/admin/offers?new=PERCENT&sku=${encodeURIComponent(firstSku)}`} className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800" data-testid="product-new-offer">＋ {tm("newOffer")}</Link> : null}
      >
        {promos.length === 0 ? <p className="text-sm text-ink-500">{tm("noOffers")}</p> : null}
        <ul className="space-y-2">
          {promos.map((pr) => (
            <li key={pr.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-ink-50 px-3 py-2 text-sm">
              <span className="font-semibold text-ink-900">{locale === "ar" ? pr.nameAr : pr.nameEn}</span>
              <span className="num rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{pr.type === "PERCENT" ? `−${(pr.percentBps ?? 0) / 100}%` : pr.type === "BUY_X_GET_Y" ? `${pr.buyQty} + ${pr.getQty}` : tm("specialPrice")}</span>
              <span className="num text-xs text-ink-500">{day(pr.startsAt)} → {day(pr.endsAt)}</span>
              {!pr.active ? <Badge>{tm("paused")}</Badge> : pr.startsAt > now ? <Badge tone="blue">{tm("planned")}</Badge> : <Badge tone="green">{tm("running")}</Badge>}
              <Link href="/admin/offers" className="ms-auto text-xs text-brand-700 underline">{tc("edit")}</Link>
            </li>
          ))}
        </ul>
      </Card>

      {/* 4. Name, Kategorie, Beschreibung */}
      {canEdit ? (
        <Card title={tm("details")}>
          <EditProductForm
            id={p.id}
            categories={opts.categories}
            initial={{ slug: p.slug, nameAr: p.nameAr, nameEn: p.nameEn, descriptionAr: p.descriptionAr ?? "", descriptionEn: p.descriptionEn ?? "", categoryId: p.categoryId, brand: p.brand?.name ?? "", visibleB2C: p.visibleB2C, visibleB2B: p.visibleB2B, active: p.active }}
          />
        </Card>
      ) : null}

      {/* 5. Für Fortgeschrittene: Einheiten, Varianten, Barcodes */}
      <details className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-200">
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-ink-800">⚙️ {tm("advanced")}<span className="ms-2 text-sm font-normal text-ink-500">{tm("advancedHint")}</span></summary>
        <div className="space-y-6 border-t border-ink-100 p-5">
          {p.variants.map((v) => (
            <Card key={v.id} title={<span className="num">{v.sku}</span>} actions={!v.active ? <Badge>{t("inactive")}</Badge> : null}>
              {canEdit ? <VariantEditor productId={p.id} variantId={v.id} initial={toValues(v)} unitNames={unitNames} canPrice={canPrice} /> : null}
            </Card>
          ))}
          {canEdit ? (
            <Card title={t("addVariant")}>
              <VariantEditor productId={p.id} variantId={null} initial={emptyVariant()} unitNames={unitNames} canPrice={canPrice} />
            </Card>
          ) : null}
        </div>
      </details>
    </div>
  );
}
