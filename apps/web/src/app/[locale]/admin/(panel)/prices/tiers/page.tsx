import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { day, money, moneyInput, range } from "@/server/format";
import { priceOptions } from "@/server/services/price-options";
import { pricePage } from "../guard";

export default async function TiersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale);
  if (!g) return <Forbidden />;
  const [t, opts, tiers] = await Promise.all([
    getTranslations("admin.prices"),
    priceOptions(locale),
    prisma.tierPrice.findMany({ orderBy: [{ variantId: "asc" }, { minQtyBase: "asc" }], include: { variant: { select: { sku: true } } } }),
  ]);
  return (
    <CrudManager
      endpoint="/api/v1/admin/prices/rules/tiers"
      canEdit={g.canEdit}
      createLabel={t("newTier")}
      skuOptions={opts.skuOptions}
      fields={[
        { name: "sku", label: t("sku"), type: "sku", required: true },
        { name: "groupId", label: t("group"), type: "select", options: opts.groups, hint: t("allGroupsHint") },
        { name: "minQtyBase", label: t("minQty"), type: "int", required: true, hint: t("minQtyHint") },
        { name: "priceNet", label: t("priceNet"), type: "money", required: true },
        { name: "validFrom", label: t("validFrom"), type: "day" },
        { name: "validTo", label: t("validTo"), type: "day" },
      ]}
      columns={[
        { key: "variant", label: t("product") },
        { key: "group", label: t("group") },
        { key: "min", label: t("minQty"), className: "num" },
        { key: "price", label: t("priceNet"), className: "num" },
        { key: "validity", label: t("validity"), className: "num" },
      ]}
      rows={tiers.map((x) => ({
        id: x.id,
        values: { sku: x.variant.sku, groupId: x.groupId ?? "", minQtyBase: String(x.minQtyBase), priceNet: moneyInput(x.priceNet), validFrom: day(x.validFrom), validTo: day(x.validTo) },
        cells: {
          variant: opts.variantLabel.get(x.variantId) ?? x.variant.sku,
          group: x.groupId ? (opts.groupName.get(x.groupId) ?? "") : t("allGroups"),
          min: `≥ ${x.minQtyBase}`,
          price: money(x.priceNet),
          validity: range(x.validFrom, x.validTo),
        },
      }))}
    />
  );
}
