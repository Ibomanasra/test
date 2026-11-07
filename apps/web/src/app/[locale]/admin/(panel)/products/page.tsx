import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Icon } from "@/components/admin/Icon";
import { Pagination } from "@/components/admin/Pagination";
import { ActiveSwitch, DeleteProductButton } from "@/components/admin/ProductActions";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Badge, Button, EmptyState, Input, Select, cn } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { money } from "@/server/format";
import { priceOptions } from "@/server/services/price-options";
import { listProducts } from "@/server/services/products-admin";

type Status = "active" | "inactive" | "archived";

export default async function ProductsAdminPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; categoryId?: string; page?: string; status?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "product.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = (["active", "inactive", "archived"] as const).includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const [t, tm, tc, data, opts] = await Promise.all([
    getTranslations("admin.products"),
    getTranslations("admin.products.manage"),
    getTranslations("common"),
    listProducts({ q: sp.q, categoryId: sp.categoryId || undefined, page, status }),
    priceOptions(locale),
  ]);
  const canEdit = hasPermission(auth.permissions, "product.edit");
  const canImport = hasPermission(auth.permissions, "product.import");
  const nm = (o: { nameAr: string; nameEn: string }) => (locale === "ar" ? o.nameAr : o.nameEn);
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, categoryId: sp.categoryId, status, ...patch })) if (v) q.set(k, v);
    return `/admin/products${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{t("title")}</h1>
          <p className="text-sm text-ink-500">{tm("count", { count: data.total })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Link href="/admin/products/new" className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800" data-testid="new-product">
              <Icon name="plus" className="size-4" /> {t("new")}
            </Link>
          ) : null}
          {canEdit ? <Link href="/admin/products/categories" className="rounded-lg bg-white px-4 py-2.5 text-sm ring-1 ring-ink-300 hover:bg-ink-50">{t("categories")}</Link> : null}
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg bg-white px-4 py-2.5 text-sm ring-1 ring-ink-300 hover:bg-ink-50">{tm("more")}</summary>
            <div className="absolute end-0 z-20 mt-1 flex w-56 flex-col gap-1 rounded-xl bg-white p-2 shadow-lg ring-1 ring-ink-200">
              {canImport ? <Link href="/admin/products/import" className="rounded-lg px-3 py-2 text-sm hover:bg-ink-50">{t("importExport")}</Link> : null}
              {hasPermission(auth.permissions, "product.print_labels") ? (
                <a href={`/api/v1/print/labels?price=1${data.items.length ? `&skus=${data.items.flatMap((p) => p.variants.map((v) => v.sku)).join(",")}` : ""}`} target="_blank" rel="noopener" className="rounded-lg px-3 py-2 text-sm hover:bg-ink-50">{t("labels")}</a>
              ) : null}
              <Link href="/admin/prices" className="rounded-lg px-3 py-2 text-sm hover:bg-ink-50">{tm("allPrices")}</Link>
              <PrintTableButton
                data={{
                  title: t("title"),
                  columns: [
                    { key: "sku", label: "SKU" },
                    { key: "name", label: t("product") },
                    { key: "category", label: t("category") },
                    { key: "stock", label: t("stock"), kind: "num" },
                  ],
                  rows: data.items.flatMap((p) => p.variants.map((v) => ({ sku: v.sku, name: nm(p), category: nm(p.category), stock: v.stockLevels.reduce((b, s) => b + s.onHand - s.reserved, 0) }))),
                }}
              />
            </div>
          </details>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-1 flex-wrap gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <div className="relative min-w-56 flex-1">
            <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <Input name="q" defaultValue={sp.q} placeholder={t("searchPlaceholder")} className="ps-9" />
          </div>
          <Select name="categoryId" defaultValue={sp.categoryId ?? ""} className="w-auto">
            <option value="">{t("category")}: {tc("all")}</option>
            {opts.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Button type="submit" variant="secondary">{tc("search")}</Button>
        </form>
        <nav className="flex gap-1 text-sm">
          {([undefined, "active", "inactive", "archived"] as const).map((s) => (
            <Link key={s ?? "all"} href={href({ status: s, page: undefined })} className={cn("rounded-full px-3 py-1 ring-1", status === s ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:bg-ink-50")}>
              {tm(`status.${s ?? "all"}`)}
            </Link>
          ))}
        </nav>
      </div>

      {data.items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-ink-200">
          {data.items.map((p) => {
            const stock = p.variants.reduce((a, v) => a + v.stockLevels.reduce((b, s) => b + s.onHand - s.reserved, 0), 0);
            const low = p.variants.some((v) => v.stockLevels.reduce((b, s) => b + s.onHand - s.reserved, 0) <= v.minStock);
            const v0 = p.variants[0];
            return (
              <li key={p.id} data-testid="product-row" className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", !p.active && "bg-ink-50/60")}>
                <Link href={`/admin/products/${p.id}`} className="shrink-0">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Produktfoto-Vorschau
                    <img src={`/api/v1/images/${p.images[0].fileId}`} alt="" className="size-14 rounded-lg object-cover ring-1 ring-ink-200" />
                  ) : (
                    <span className="grid size-14 place-items-center rounded-lg bg-ink-100 text-ink-400"><Icon name="box" /></span>
                  )}
                </Link>
                <div className="min-w-48 flex-1">
                  <Link href={`/admin/products/${p.id}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">{nm(p)}</Link>
                  <p className="text-xs text-ink-500">
                    <span className="num">{p.variants.map((v) => v.sku).join(", ")}</span> · {nm(p.category)}
                    {p.isDemo ? <span className="ms-2"><Badge>{tc("demoBadge")}</Badge></span> : null}
                    {p.archivedAt ? <span className="ms-2"><Badge tone="neutral">{tm("archived")}</Badge></span> : null}
                  </p>
                </div>
                <div className="w-28 text-end">
                  <p className="num font-semibold text-ink-900">{v0 ? money(v0.b2cPrice) : "–"}</p>
                  <p className="num text-xs text-ink-500">{tm("dealer")} {v0 ? money(v0.b2bBasePrice) : "–"}</p>
                </div>
                <div className="w-24 text-end">
                  <p className={cn("num font-semibold", stock <= 0 ? "text-red-700" : low ? "text-amber-700" : "text-ink-900")}>{stock}</p>
                  <p className="text-xs text-ink-500">{stock <= 0 ? tm("outOfStock") : low ? t("lowStock") : tm("inStock")}</p>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    {p.archivedAt ? null : <ActiveSwitch productId={p.id} active={p.active} />}
                    <Link href={`/admin/products/${p.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-ink-700 hover:bg-ink-100" aria-label={tc("edit")}>
                      <Icon name="edit" className="size-4" /><span className="hidden sm:inline">{tc("edit")}</span>
                    </Link>
                    {p.archivedAt ? null : <DeleteProductButton productId={p.id} name={nm(p)} />}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
