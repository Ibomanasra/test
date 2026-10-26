import { priceListQuerySchema } from "@sa/contracts";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { Button, Input, Num, Select } from "@/components/ui";
import { money, moneyInput, pct } from "@/server/format";
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

  const fields = [
    ...(g.canSeeCost ? [{ name: "costPrice", label: t("cost"), type: "money" as const, required: true }] : []),
    { name: "b2cPrice", label: t("b2c"), type: "money" as const, required: true, hint: t("b2cHint") },
    { name: "b2bBasePrice", label: t("b2b"), type: "money" as const, required: true, hint: t("b2bHint") },
  ];
  const columns = [
    { key: "sku", label: t("sku"), className: "num" },
    { key: "name", label: t("product"), className: "min-w-56" },
    { key: "category", label: t("category") },
    ...(g.canSeeCost ? [{ key: "cost", label: t("cost"), className: "num" }] : []),
    { key: "b2c", label: t("b2c"), className: "num" },
    { key: "b2b", label: t("b2b"), className: "num" },
    ...(g.canSeeCost ? [{ key: "margin", label: t("margin"), className: "num" }, { key: "flag", label: "" }] : []),
  ];
  const rows = data.items.map((v) => ({
    id: v.id,
    tone: g.canSeeCost && v.belowMargin ? ("warn" as const) : undefined,
    values: { costPrice: moneyInput(v.costPrice), b2cPrice: moneyInput(v.b2cPrice), b2bBasePrice: moneyInput(v.b2bBasePrice) },
    cells: {
      sku: v.sku,
      name: opts.variantLabel.get(v.id)?.split(" · ")[1] ?? "",
      category: locale === "ar" ? v.product.category.nameAr : v.product.category.nameEn,
      cost: money(v.costPrice),
      b2c: money(v.b2cPrice),
      b2b: money(v.b2bBasePrice),
      margin: `${pct(v.marginB2cBps)} / ${pct(v.marginB2bBps)}`,
      flag: v.belowMargin ? t("belowMarginBadge") : "",
    },
  }));

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
      <p className="text-sm text-ink-500">
        <Num>{data.total}</Num> · {t("vatNote", { rate: pct(data.taxRateBps) })} {g.canSeeCost ? `· ${t("minMarginNote", { margin: pct(data.minMarginBps) })}` : ""}
      </p>
      <CrudManager
        endpoint="/api/v1/admin/prices/variants"
        fields={fields}
        columns={columns}
        rows={rows}
        canEdit={g.canEdit}
        allowCreate={false}
        deletable={false}
        createLabel=""
        testId="variant-prices"
      />
      <Pagination page={filter.page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
