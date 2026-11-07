import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductCard } from "@/components/shop/ProductCard";
import { Link } from "@/i18n/navigation";
import { listCatalog, listCategories, type ProductDto } from "@/server/services/catalog";
import { currentTaxRateBps } from "@/server/services/pricing";
import { currentViewer } from "@/server/viewer";
import { OfferBanners } from "@/components/shop/OfferBanners";
import { shopOffers } from "@/server/services/offers";
import { getStorefront } from "@/server/services/storefront";
import { ShopHero } from "@/components/shop/ShopHero";

const ROW = 4;

function ProductRow({ title, href, more, items, vatBps, testId }: { title: string; href: string; more: string; items: ProductDto[]; vatBps: number; testId?: string }) {
  if (!items.length) return null;
  return (
    <section data-testid={testId}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        <Link href={href} className="text-sm font-medium whitespace-nowrap text-brand-700 hover:underline">{more}</Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => <ProductCard key={p.id} product={p} vatBps={vatBps} />)}
      </ul>
    </section>
  );
}

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await currentViewer();
  const [t, categories, vat, promos, offers, front] = await Promise.all([
    getTranslations("shop"),
    listCategories(),
    currentTaxRateBps(new Date()),
    listCatalog(viewer, { promo: true, page: 1 }),
    shopOffers(viewer.channel),
    getStorefront(),
  ]);
  // je Kategorie eine kurze Reihe (Preise für den Kanal des Betrachters)
  const rows = await Promise.all(categories.filter((c) => c._count.products > 0).map(async (c) => ({ c, items: (await listCatalog(viewer, { category: c.slug, page: 1, take: ROW })).items })));
  return (
    <div className="space-y-8">
      <ShopHero title={locale === "ar" ? front.titleAr : front.titleEn} text={locale === "ar" ? front.textAr : front.textEn} imageFileId={front.imageFileId} photoIds={front.photoIds} productCount={front.productCount} />
      {offers.length ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold">{t("offers.title")}</h2>
            <Link href="/offers" className="text-sm font-medium text-brand-700 hover:underline">{t("offers.all")}</Link>
          </div>
          <OfferBanners offers={offers.slice(0, 3)} compact />
        </section>
      ) : null}
      <section>
        <h2 className="mb-3 text-xl font-bold">{t("categories")}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/products?category=${c.slug}`} className="block rounded-xl bg-white p-4 text-center font-medium shadow-sm ring-1 ring-ink-200 hover:ring-brand-400">
                {locale === "ar" ? c.nameAr : c.nameEn}
                <span className="num block text-xs text-ink-500">{c._count.products}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <ProductRow title={t("home.offers")} href="/products?promo=1" more={t("home.allOffers")} items={promos.items.slice(0, ROW)} vatBps={vat} testId="home-offers" />
      {rows.map(({ c, items }) => (
        <ProductRow key={c.id} title={locale === "ar" ? c.nameAr : c.nameEn} href={`/products?category=${c.slug}`} more={t("home.showAll", { count: c._count.products })} items={items} vatBps={vat} testId="home-category" />
      ))}
      <div className="text-center">
        <Link href="/products" className="inline-block rounded-lg bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800">{t("home.allProducts")}</Link>
      </div>
    </div>
  );
}
