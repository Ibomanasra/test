import { hasPermission } from "@sa/core";
import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { NewProductForm } from "@/components/admin/ProductForms";
import { QuickProductForm } from "@/components/admin/QuickProductForm";
import { PageHeader } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { priceOptions } from "@/server/services/price-options";

/** Standard: Schnellformular; ?advanced=1 = vollständiges Formular (Varianten, Einheiten, Regeln) */
export default async function NewProductPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ advanced?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "product.edit");
  if (!auth) return <Forbidden />;
  const advanced = (await searchParams).advanced === "1";
  const [t, opts, units] = await Promise.all([getTranslations("admin.products"), priceOptions(locale), prisma.unitOfMeasure.findMany()]);
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(auth.permissions, p);
  return (
    <div>
      <PageHeader title={t("new")} />
      {advanced ? (
        <NewProductForm categories={opts.categories} unitNames={Object.fromEntries(units.map((u) => [u.code, locale === "ar" ? u.nameAr : u.nameEn]))} canPrice={can("price.edit")} />
      ) : (
        <QuickProductForm categories={opts.categories} canSeeCost={can("price.view_cost")} canStock={can("stock.adjust")} />
      )}
    </div>
  );
}
