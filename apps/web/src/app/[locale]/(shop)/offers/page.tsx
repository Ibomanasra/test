import { getTranslations, setRequestLocale } from "next-intl/server";
import { OfferBanners } from "@/components/shop/OfferBanners";
import { ProductCard } from "@/components/shop/ProductCard";
import { Link } from "@/i18n/navigation";
import { listCatalog } from "@/server/services/catalog";
import { shopOffers } from "@/server/services/offers";
import { currentTaxRateBps } from "@/server/services/pricing";
import { currentViewer } from "@/server/viewer";

/** Alle Angebote auf einen Blick: Vorteile auf die Bestellung + reduzierte Produkte */
export default async function OffersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await currentViewer();
  const [t, offers, promos, vat] = await Promise.all([getTranslations("shop.offers"), shopOffers(viewer.channel), listCatalog(viewer, { promo: true, page: 1, take: 48 }), currentTaxRateBps(new Date())]);
  return (
    <div className="space-y-8">
      <header className="rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 px-6 py-8 text-white sm:px-10">
        <h1 className="text-3xl font-extrabold">🔥 {t("pageTitle")}</h1>
        <p className="mt-2 max-w-2xl text-white/90">{t("pageText")}</p>
      </header>
      {offers.length ? (
        <section>
          <h2 className="mb-3 text-xl font-bold">{t("onOrder")}</h2>
          <OfferBanners offers={offers} />
          <p className="mt-2 text-sm text-ink-500">{t("autoNote")}</p>
        </section>
      ) : null}
      <section>
        <h2 className="mb-3 text-xl font-bold">{t("onProducts")}</h2>
        {promos.items.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-center text-ink-500 ring-1 ring-ink-200">{t("noProducts")} <Link href="/products" className="text-brand-700 underline">{t("browse")}</Link></p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {promos.items.map((p) => <ProductCard key={p.id} product={p} vatBps={vat} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
