import { priceListQuerySchema } from "@sa/contracts";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasPermission } from "@sa/core";
import { PriceGrid } from "@/components/admin/PriceGrid";
import { Link } from "@/i18n/navigation";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { Button, Input, Num, Select } from "@/components/ui";
import { pct } from "@/server/format";
import { listVariantPrices } from "@/server/services/prices-admin";
import { priceOptions } from "@/server/services/price-options";
import { pricePage } from "./guard";

export default async function PriceOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale);
  if (!g) return <Forbidden />;
  const parsed = priceListQuerySchema.safeParse(await searchParams);
  const filter = parsed.success ? parsed.data : { page: 1 };
  const [t, tc, data, opts] = await Promise.all([getTranslations("admin.prices"), getTranslations("common"), listVariantPrices(filter), priceOptions(locale)]);

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={filter.q} placeholder={t("searchPlaceholder")} className="max-w-xs" />
        <Select name="categoryId" defaultValue={filter.categoryId ?? ""} className="w-auto">
          <option value="">{t("category")}: {tc("all")}</option>
          {opts.categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
        {g.canSeeCost ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="belowMargin" value="1" defaultChecked={!!filter.belowMargin} className="size-4 accent-brand-700" />
            {t("onlyBelowMargin")}
          </label>
        ) : null}
        <Button type="submit" variant="secondary">{tc("filter")}</Button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
        <span><Num>{data.total}</Num> {t("grid.products")}</span>
        <Link href="/admin/settings/tax" className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.taxRateBps > 0 ? "bg-green-100 text-green-800" : "bg-ink-100 text-ink-700"}`} data-testid="vat-pill">
          {data.taxRateBps > 0 ? t("grid.vatOn", { rate: pct(data.taxRateBps) }) : t("grid.vatOff")}
        </Link>
        {g.canSeeCost ? <span className="text-ink-500">· {t("minMarginNote", { margin: pct(data.minMarginBps) })}</span> : null}
        {g.canEdit ? <span className="ms-auto text-xs text-ink-500">{t("grid.hint")}</span> : null}
      </div>
      <PriceGrid
        taxRateBps={data.taxRateBps}
        minMarginBps={data.minMarginBps}
        canSeeCost={g.canSeeCost}
        canEdit={g.canEdit}
        canConfirmBelow={hasPermission(g.auth.permissions, "price.confirm_below_margin")}
        rows={data.items.map((v) => ({
          id: v.id,
          sku: v.sku,
          name: opts.variantLabel.get(v.id)?.split(" · ")[1] ?? "",
          category: locale === "ar" ? v.product.category.nameAr : v.product.category.nameEn,
          costPrice: v.costPrice,
          b2cPrice: v.b2cPrice,
          b2bBasePrice: v.b2bBasePrice,
        }))}
      />
      <Pagination page={filter.page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
