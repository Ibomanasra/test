import { catalogQuerySchema } from "@sa/contracts";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Pagination } from "@/components/admin/Pagination";
import { ProductCard } from "@/components/shop/ProductCard";
import { Button, EmptyState, Input, PageHeader, cn } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { listCatalog, listCategories } from "@/server/services/catalog";
import { currentTaxRateBps } from "@/server/services/pricing";
import { currentViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("shop.catalog");
  return { title: t("title") };
}

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const parsed = catalogQuerySchema.safeParse(await searchParams);
  const f = parsed.success ? parsed.data : { page: 1 };
  const viewer = await currentViewer();
  const [t, tc, data, categories, vat] = await Promise.all([
    getTranslations("shop.catalog"),
    getTranslations("common"),
    listCatalog(viewer, { q: f.q, category: f.category, promo: f.promo === "1", page: f.page }),
    listCategories(),
    currentTaxRateBps(new Date()),
  ]);
  const lang = await getLocale();
  const nm = (o: { nameAr: string | null; nameEn: string | null }) => (lang === "ar" ? o.nameAr : o.nameEn);
  const chip = (href: string, label: string, active: boolean) => (
    <Link key={href} href={href} className={cn("rounded-full px-3 py-1.5 text-sm whitespace-nowrap ring-1", active ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-ink-700 ring-ink-200 hover:ring-brand-400")}>
      {label}
    </Link>
  );
  return (
    <div className="space-y-6">
      <PageHeader title={f.promo ? t("offers") : t("title")} subtitle={t("count", { count: data.total })} />
      <form method="get" className="flex gap-2">
        {f.category ? <input type="hidden" name="category" value={f.category} /> : null}
        <Input name="q" defaultValue={f.q} placeholder={(await getTranslations("shop"))("searchPlaceholder")} className="max-w-md" data-testid="catalog-search" />
        <Button type="submit" variant="secondary">{tc("search")}</Button>
      </form>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {chip("/products", tc("all"), !f.category && !f.promo)}
        {chip("/products?promo=1", t("offers"), !!f.promo)}
        {categories.map((c) => chip(`/products?category=${c.slug}`, nm(c) ?? c.slug, f.category === c.slug))}
      </div>
      {data.items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {data.items.map((p) => <ProductCard key={p.id} product={p} vatBps={vat} />)}
        </ul>
      )}
      <Pagination page={f.page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
