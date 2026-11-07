import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductCard } from "@/components/shop/ProductCard";
import { Link } from "@/i18n/navigation";
import { listCatalog, listCategories, type ProductDto } from "@/server/services/catalog";
import { currentTaxRateBps } from "@/server/services/pricing";
import { currentViewer } from "@/server/viewer";
import { OfferBanners } from "@/components/shop/OfferBanners";
import { shopOffers } from "@/server/services/offers";

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
  const [t, categories, vat, promos, offers] = await Promise.all([
    getTranslations("shop"),
    listCategories(),
    currentTaxRateBps(new Date()),
    listCatalog(viewer, { promo: true, page: 1 }),
    shopOffers(viewer.channel),
  ]);
  // je Kategorie eine kurze Reihe (Preise für den Kanal des Betrachters)
  const rows = await Promise.all(categories.filter((c) => c._count.products > 0).map(async (c) => ({ c, items: (await listCatalog(viewer, { category: c.slug, page: 1, take: ROW })).items })));
  const benefits = [t("benefits.delivery"), t("benefits.wholesale"), t("benefits.payment")];
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-10 text-white sm:px-10 sm:py-14">
        <h1 className="max-w-2xl text-3xl leading-tight font-bold sm:text-4xl">{t("hero.title")}</h1>
        <p className="mt-4 max-w-2xl text-brand-100">{t("hero.text")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/products" className="rounded-lg bg-white px-5 py-2.5 font-semibold text-brand-800 hover:bg-brand-50">
            {t("hero.ctaShop")}
          </Link>
          <Link href="/register?type=b2b" className="rounded-lg px-5 py-2.5 font-semibold text-white ring-1 ring-white/60 hover:bg-white/10">
            {t("hero.ctaBusiness")}
          </Link>
        </div>
      </section>
      {offers.length ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold">{t("offers.title")}</h2>
            <Link href="/offers" className="text-sm font-medium text-brand-700 hover:underline">{t("offers.all")}</Link>
          </div>
          <OfferBanners offers={offers.slice(0, 3)} compact />
        </section>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-3">
        {benefits.map((b) => (
          <li key={b} className="rounded-xl bg-white p-5 font-medium shadow-sm ring-1 ring-ink-200">
            {b}
          </li>
        ))}
      </ul>
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
