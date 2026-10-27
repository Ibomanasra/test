import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Badge, Button, EmptyState, Input, Num, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { priceOptions } from "@/server/services/price-options";
import { listProducts } from "@/server/services/products-admin";

export default async function ProductsAdminPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; categoryId?: string; page?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "product.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, tc, data, opts] = await Promise.all([getTranslations("admin.products"), getTranslations("common"), listProducts({ q: sp.q, categoryId: sp.categoryId || undefined, page }), priceOptions(locale)]);
  const canEdit = hasPermission(auth.permissions, "product.edit");
  const canImport = hasPermission(auth.permissions, "product.import");
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={<Num>{data.total}</Num>}
        actions={
          <>
            {canEdit ? <Link href="/admin/products/new" className="rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white">{t("new")}</Link> : null}
            {canEdit ? <Link href="/admin/products/categories" className="rounded-lg px-4 py-2.5 ring-1 ring-ink-300">{t("categories")}</Link> : null}
            {canImport ? <Link href="/admin/products/import" className="rounded-lg px-4 py-2.5 ring-1 ring-ink-300">{t("importExport")}</Link> : null}
            {hasPermission(auth.permissions, "product.print_labels") ? <a href={`/api/v1/print/labels?price=1${data.items.length ? `&skus=${data.items.flatMap((p) => p.variants.map((v) => v.sku)).join(",")}` : ""}`} target="_blank" rel="noopener" className="rounded-lg px-4 py-2.5 ring-1 ring-ink-300">{t("labels")}</a> : null}
            <PrintTableButton
              size="md"
              data={{
                title: t("title"),
                columns: [
                  { key: "sku", label: "SKU" },
                  { key: "name", label: t("product") },
                  { key: "category", label: t("category") },
                  { key: "stock", label: t("stock"), kind: "num" },
                ],
                rows: data.items.flatMap((p) =>
                  p.variants.map((v) => ({
                    sku: v.sku,
                    name: locale === "ar" ? p.nameAr : p.nameEn,
                    category: p.category ? (locale === "ar" ? p.category.nameAr : p.category.nameEn) : "",
                    stock: v.stockLevels.reduce((b, s) => b + s.onHand - s.reserved, 0),
                  })),
                ),
              }}
            />
          </>
        }
      />
      <form method="get" className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder={t("searchPlaceholder")} className="max-w-xs" />
        <Select name="categoryId" defaultValue={sp.categoryId ?? ""} className="w-auto">
          <option value="">{t("category")}: {tc("all")}</option>
          {opts.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
        <Button type="submit" variant="secondary">{tc("filter")}</Button>
      </form>
      {data.items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("product")}</Th>
              <Th>SKU</Th>
              <Th>{t("category")}</Th>
              <Th>{t("stock")}</Th>
              <Th>{t("visibility")}</Th>
              <Th>{tc("status")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.items.map((p) => {
              const stock = p.variants.reduce((a, v) => a + v.stockLevels.reduce((b, s) => b + s.onHand - s.reserved, 0), 0);
              const low = p.variants.some((v) => v.stockLevels.reduce((b, s) => b + s.onHand - s.reserved, 0) <= v.minStock);
              return (
                <tr key={p.id} data-testid="product-row">
                  <Td><Link href={`/admin/products/${p.id}`} className="font-medium text-brand-700 hover:underline">{locale === "ar" ? p.nameAr : p.nameEn}</Link>{p.isDemo ? <span className="ms-2"><Badge>{tc("demoBadge")}</Badge></span> : null}</Td>
                  <Td className="num text-xs">{p.variants.map((v) => v.sku).join(", ")}</Td>
                  <Td>{locale === "ar" ? p.category.nameAr : p.category.nameEn}</Td>
                  <Td className="num">{stock}{low ? <span className="ms-1"><Badge tone="amber">{t("lowStock")}</Badge></span> : null}</Td>
                  <Td className="text-xs">{[p.visibleB2C ? "B2C" : null, p.visibleB2B ? "B2B" : null].filter(Boolean).join(" · ") || "–"}</Td>
                  <Td><Badge tone={p.active ? "green" : "neutral"}>{p.active ? tc("active") : tc("inactive")}</Badge></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
