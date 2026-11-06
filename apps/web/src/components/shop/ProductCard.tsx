import { getLocale, getTranslations } from "next-intl/server";
import { AddToCart } from "@/components/shop/AddToCart";
import { AvailabilityBadge } from "@/components/shop/AvailabilityBadge";
import { PriceTag } from "@/components/shop/PriceTag";
import { ProductImage } from "@/components/shop/ProductImage";
import { Badge } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { ProductDto } from "@/server/services/catalog";

/** Produktkarte für Katalog und Startseite (Preise bereits für den Kanal des Betrachters) */
export async function ProductCard({ product: p, vatBps }: { product: ProductDto; vatBps: number }) {
  const [t, lang] = await Promise.all([getTranslations("shop.catalog"), getLocale()]);
  const nm = (o: { nameAr: string | null; nameEn: string | null }) => (lang === "ar" ? o.nameAr : o.nameEn);
  const v = p.variants[0];
  if (!v) return null;
  const unit = v.units.find((u) => u.code === v.defaultUnit) ?? v.units[0];
  return (
    <li className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink-200 transition hover:shadow-md" data-testid="product-card">
      <Link href={`/products/${p.slug}`} className="block">
        <ProductImage imageId={p.imageIds[0]} name={nm(p) ?? ""} />
        <div className="mt-3 flex flex-wrap gap-1">
          {v.promotion ? <Badge tone="brand">{t("promo")}</Badge> : null}
          <AvailabilityBadge value={v.availability} />
        </div>
        <h3 className="mt-2 line-clamp-2 font-semibold">{nm(p)}</h3>
        <p className="text-xs text-ink-500">
          <span className="num">{v.sku}</span>
          {p.variants.length > 1 ? ` · ${t("variants", { count: p.variants.length })}` : ""}
        </p>
      </Link>
      <div className="mt-3">
        <PriceTag channel={p.channel} unitPrice={v.unitPrice} listUnitPrice={v.listUnitPrice} factor={unit?.factor} unitName={unit ? (nm(unit) ?? "") : ""} vatBps={vatBps} />
      </div>
      <div className="mt-auto pt-3">
        <AddToCart variantId={v.id} units={v.units} defaultUnit={v.defaultUnit} minQtyBase={v.minQtyBase} qtyStepBase={v.qtyStepBase} disabled={v.availability === "out"} compact />
      </div>
    </li>
  );
}
