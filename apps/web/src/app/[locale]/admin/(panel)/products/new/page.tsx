import { hasPermission } from "@sa/core";
import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { NewProductForm } from "@/components/admin/ProductForms";
import { PageHeader } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { priceOptions } from "@/server/services/price-options";

export default async function NewProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "product.edit");
  if (!auth) return <Forbidden />;
  const [t, opts, units] = await Promise.all([getTranslations("admin.products"), priceOptions(locale), prisma.unitOfMeasure.findMany()]);
  return (
    <div>
      <PageHeader title={t("new")} />
      <NewProductForm categories={opts.categories} unitNames={Object.fromEntries(units.map((u) => [u.code, locale === "ar" ? u.nameAr : u.nameEn]))} canPrice={hasPermission(auth.permissions, "price.edit")} />
    </div>
  );
}
