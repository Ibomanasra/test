import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { ProductImport } from "@/components/admin/ProductImport";
import { PageHeader } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";

export default async function ProductImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "product.import"))) return <Forbidden />;
  const t = await getTranslations("admin.products");
  return (
    <div>
      <PageHeader title={t("importExport")} />
      <ProductImport />
    </div>
  );
}
