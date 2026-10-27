import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { PageHeader } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "product.edit"))) return <Forbidden />;
  const [t, tc, cats] = await Promise.all([getTranslations("admin.products"), getTranslations("common"), prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } })]);
  const name = new Map(cats.map((c) => [c.id, locale === "ar" ? c.nameAr : c.nameEn]));
  return (
    <div>
      <PageHeader title={t("categories")} />
      <CrudManager
        endpoint="/api/v1/admin/categories"
        canEdit
        createLabel={t("newCategory")}
        defaults={{ active: true, sortOrder: "0" }}
        fields={[
          { name: "slug", label: t("slug"), type: "text", required: true, dir: "ltr" },
          { name: "nameAr", label: t("nameAr"), type: "text", required: true, dir: "rtl" },
          { name: "nameEn", label: t("nameEn"), type: "text", required: true, dir: "ltr" },
          { name: "parentId", label: t("parent"), type: "select", options: cats.map((c) => ({ value: c.id, label: name.get(c.id) ?? "" })) },
          { name: "sortOrder", label: t("sortOrder"), type: "int" },
          { name: "active", label: tc("active"), type: "checkbox" },
        ]}
        columns={[
          { key: "name", label: tc("name") },
          { key: "slug", label: t("slug"), className: "num" },
          { key: "parent", label: t("parent") },
          { key: "count", label: t("productsCount"), className: "num" },
        ]}
        rows={cats.map((c) => ({
          id: c.id,
          tone: c.active ? undefined : "muted",
          values: { slug: c.slug, nameAr: c.nameAr, nameEn: c.nameEn, parentId: c.parentId ?? "", sortOrder: String(c.sortOrder), active: c.active },
          cells: { name: name.get(c.id) ?? "", slug: c.slug, parent: c.parentId ? (name.get(c.parentId) ?? "") : "–", count: String(c._count.products) },
        }))}
      />
    </div>
  );
}
