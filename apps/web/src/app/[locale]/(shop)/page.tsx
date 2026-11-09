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
const FIRST = 12;

function ProductRow({ title, href, more, items, vatBps, testId }: { title: string; href: string; more: string; items: ProductDto[]; vatBps: number; testId?: string }) {
  if (!items.length) return null;
  return (
    <section data-testid={testId}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        <Link href={href} className="text-sm font-medium whitespace-nowrap text-brand-700 hover:underline">{more}</Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
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
  // Alle Produkte zuerst (erste Seite), Angebote danach
  const all = await listCatalog(viewer, { page: 1, take: FIRST });
  const chip = (href: string, label: string, active = false) => (
    <Link key={href} href={href} className={active ? "shrink-0 rounded-full bg-brand-700 px-3.5 py-1.5 text-sm font-semibold text-white" : "shrink-0 rounded-full bg-white px-3.5 py-1.5 text-sm text-ink-700 ring-1 ring-ink-200 hover:ring-brand-400"}>
      {label}
    </Link>
  );
  return (
    <div className="space-y-8">
      <ShopHero title={locale === "ar" ? front.titleAr : front.titleEn} text={locale === "ar" ? front.textAr : front.textEn} imageFileId={front.imageFileId} photoIds={front.photoIds} productCount={front.productCount} />
      {/* 1. Alle Produkte – mit Kategorie-Leiste */}
      <section data-testid="home-all">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold">{t("home.allTitle")}</h2>
          <Link href="/products" className="text-sm font-medium whitespace-nowrap text-brand-700 hover:underline">{t("home.showAll", { count: all.total })}</Link>
        </div>
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {chip("/products", (await getTranslations("common"))("all"), true)}
          {promos.total ? chip("/products?promo=1", `🔥 ${t("catalog.offers")}`) : null}
          {categories.filter((c) => c._count.products > 0).map((c) => chip(`/products?category=${c.slug}`, (locale === "ar" ? c.nameAr : c.nameEn) ?? c.slug))}
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {all.items.map((p) => <ProductCard key={p.id} product={p} vatBps={vat} />)}
        </ul>
        {all.total > all.items.length ? (
          <div className="mt-5 text-center">
            <Link href="/products" className="inline-block rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800" data-testid="home-show-all">{t("home.showAll", { count: all.total })}</Link>
          </div>
        ) : null}
      </section>

      {/* 2. Danach die Angebote */}
      {offers.length ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold">{t("offers.title")}</h2>
            <Link href="/offers" className="text-sm font-medium text-brand-700 hover:underline">{t("offers.all")}</Link>
          </div>
          <OfferBanners offers={offers.slice(0, 3)} compact />
        </section>
      ) : null}
      <ProductRow title={t("home.offers")} href="/products?promo=1" more={t("home.allOffers")} items={promos.items.slice(0, ROW)} vatBps={vat} testId="home-offers" />
    </div>
  );
}
