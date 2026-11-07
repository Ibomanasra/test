import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { AddToCart } from "@/components/shop/AddToCart";
import { PriceTag } from "@/components/shop/PriceTag";
import { ProductImage } from "@/components/shop/ProductImage";
import { Link } from "@/i18n/navigation";
import type { ProductDto } from "@/server/services/catalog";
import { activePromotionInfo } from "@/server/services/promo-info";

/** Produktkarte für Katalog und Startseite (Preise bereits für den Kanal des Betrachters) */
export async function ProductCard({ product: p, vatBps }: { product: ProductDto; vatBps: number }) {
  const [t, lang] = await Promise.all([getTranslations("shop.catalog"), getLocale()]);
  const nm = (o: { nameAr: string | null; nameEn: string | null }) => (lang === "ar" ? o.nameAr : o.nameEn);
  const v = p.variants[0];
  if (!v) return null;
  const unit = v.units.find((u) => u.code === v.defaultUnit) ?? v.units[0];
  const promo = v.promoRef ? (await activePromotionInfo()).get(v.promoRef) : undefined;
  // Schild: „−15 %“ bzw. „2 + 1“; Restlaufzeit, wenn bald endend
  const pctOff = v.listUnitPrice && v.listUnitPrice > v.unitPrice ? Math.round((1 - v.unitPrice / v.listUnitPrice) * 100) : 0;
  const badge = promo?.type === "BUY_X_GET_Y" ? `${promo.buyQty} + ${promo.getQty}` : pctOff > 0 ? `−${pctOff}%` : null;
  const daysLeft = promo?.daysLeft ?? null;
  const name = nm(p) ?? "";
  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-200 transition hover:-translate-y-0.5 hover:shadow-md" data-testid="product-card">
      <Link href={`/products/${p.slug}`} className="relative block bg-gradient-to-b from-ink-50 to-white p-2 sm:p-3">
        <ProductImage imageId={p.imageIds[0]} name={name} className="transition duration-300 group-hover:scale-[1.03]" />
        {badge ? <span className="num absolute start-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow sm:px-2.5 sm:py-1 sm:text-sm" data-testid="promo-badge">{badge}</span> : null}
        {v.availability !== "in_stock" ? (
          <span className={`absolute end-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${v.availability === "low" ? "bg-amber-100 text-amber-900" : "bg-ink-800 text-white"}`}>
            <AvailabilityText value={v.availability} />
          </span>
        ) : null}
        {daysLeft != null && daysLeft <= 7 ? (
          <span className="absolute inset-x-2 bottom-2 rounded-lg bg-red-600/90 px-2 py-0.5 text-center text-[11px] font-medium text-white">⏳ {daysLeft <= 1 ? t("endsToday") : t("endsIn", { days: daysLeft })}</span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-2.5 pt-1 sm:px-4 sm:pb-4">
        <Link href={`/products/${p.slug}`} className="block">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-ink-900 sm:text-base sm:leading-6">{name}</h3>
        </Link>
        {promo?.type === "BUY_X_GET_Y" ? <p className="text-[11px] font-semibold text-green-700">🎁 {t("buyGet", { buy: promo.buyQty ?? 0, get: promo.getQty ?? 0 })}</p> : null}
        {p.variants.length > 1 ? <p className="text-[11px] text-ink-500">{t("variants", { count: p.variants.length })}</p> : null}
        <PriceTag channel={p.channel} unitPrice={v.unitPrice} listUnitPrice={v.listUnitPrice} factor={unit?.factor} unitName={unit ? (nm(unit) ?? "") : ""} vatBps={vatBps} size="sm" />
        <div className="mt-auto pt-2">
          <AddToCart variantId={v.id} units={v.units} defaultUnit={v.defaultUnit} minQtyBase={v.minQtyBase} qtyStepBase={v.qtyStepBase} disabled={v.availability === "out"} compact name={name} imageId={p.imageIds[0] ?? null} />
        </div>
      </div>
    </li>
  );
}

function AvailabilityText({ value }: { value: "low" | "out" | "in_stock" }) {
  const t = useTranslations("shop.availability");
  return <>{t(value)}</>;
}
