import { formatMoney } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/shop/AddToCart";
import { AvailabilityBadge } from "@/components/shop/AvailabilityBadge";
import { PriceTag } from "@/components/shop/PriceTag";
import { ProductImage } from "@/components/shop/ProductImage";
import { Badge, Card, Num, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { getCatalogProduct } from "@/server/services/catalog";
import { currentTaxRateBps } from "@/server/services/pricing";
import { currentViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const viewer = await currentViewer();
  const [p, t, vat] = await Promise.all([getCatalogProduct(viewer, slug), getTranslations("shop.catalog"), currentTaxRateBps(new Date())]);
  if (!p) notFound();
  const nm = (o: { nameAr: string | null; nameEn: string | null }) => (locale === "ar" ? o.nameAr : o.nameEn);
  return (
    <div className="space-y-6">
      <nav className="text-sm text-ink-500">
        <Link href="/products" className="hover:underline">{t("title")}</Link> / <Link href={`/products?category=${p.category.slug}`} className="hover:underline">{nm(p.category)}</Link>
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <ProductImage imageId={p.imageIds[0]} name={nm(p) ?? ""} className="max-h-[28rem]" />
          {p.imageIds.length > 1 ? (
            <div className="grid grid-cols-4 gap-2">
              {p.imageIds.slice(1, 5).map((id) => (
                <ProductImage key={id} imageId={id} name={nm(p) ?? ""} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="product-title">{nm(p)}</h1>
            {p.brand ? <p className="text-sm text-ink-500">{p.brand}</p> : null}
          </div>
          {nm({ nameAr: p.descriptionAr, nameEn: p.descriptionEn }) ? <p className="text-ink-700">{nm({ nameAr: p.descriptionAr, nameEn: p.descriptionEn })}</p> : null}
          {p.variants.map((v) => {
            const unit = v.units.find((u) => u.code === v.defaultUnit) ?? v.units[0];
            return (
              <Card key={v.id}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {v.nameAr || v.nameEn ? <h2 className="font-semibold">{nm(v)}</h2> : null}
                  <span className="num text-xs text-ink-500">SKU {v.sku}{v.barcode ? ` · ${v.barcode}` : ""}</span>
                  <AvailabilityBadge value={v.availability} />
                  {v.promotion ? <Badge tone="brand">{t("promo")}</Badge> : null}
                </div>
                <PriceTag channel={p.channel} unitPrice={v.unitPrice} listUnitPrice={v.listUnitPrice} factor={unit?.factor} unitName={unit ? nm(unit) ?? "" : ""} vatBps={vat} size="lg" />
                {v.tiers?.length ? (
                  <div className="mt-4">
                    <h3 className="mb-2 text-sm font-semibold">{t("tiers")}</h3>
                    <Table>
                      <thead>
                        <tr>
                          <Th>{t("fromQty")}</Th>
                          <Th>{t("perPiece")}</Th>
                          {unit && unit.factor > 1 ? <Th>{t("perUnit", { unit: nm(unit) ?? "" })}</Th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100" data-testid="tier-table">
                        {v.tiers.map((tier) => (
                          <tr key={tier.minQtyBase}>
                            <Td><Num>{`≥ ${tier.minQtyBase}`}</Num>{unit && unit.factor > 1 ? <span className="text-xs text-ink-500"> ({tier.minQtyBase / unit.factor} × {nm(unit)})</span> : null}</Td>
                            <Td className="num">{formatMoney(tier.unitPrice)}</Td>
                            {unit && unit.factor > 1 ? <Td className="num">{formatMoney(tier.unitPrice * unit.factor)}</Td> : null}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : null}
                <div className="mt-4">
                  <AddToCart variantId={v.id} units={v.units} defaultUnit={v.defaultUnit} minQtyBase={v.minQtyBase} qtyStepBase={v.qtyStepBase} disabled={v.availability === "out"} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
