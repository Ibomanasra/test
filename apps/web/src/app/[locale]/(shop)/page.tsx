import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listCategories } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, categories] = await Promise.all([getTranslations("shop"), listCategories()]);
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
    </div>
  );
}
