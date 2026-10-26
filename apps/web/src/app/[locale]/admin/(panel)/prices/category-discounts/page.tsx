import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { day, pct, pctInput, range } from "@/server/format";
import { priceOptions } from "@/server/services/price-options";
import { pricePage } from "../guard";

export default async function CategoryDiscountsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale);
  if (!g) return <Forbidden />;
  const [t, opts, rows] = await Promise.all([getTranslations("admin.prices"), priceOptions(locale), prisma.categoryDiscount.findMany({ orderBy: { categoryId: "asc" } })]);
  return (
    <CrudManager
      endpoint="/api/v1/admin/prices/rules/category-discounts"
      canEdit={g.canEdit}
      createLabel={t("newCategoryDiscount")}
      fields={[
        { name: "categoryId", label: t("category"), type: "select", required: true, options: opts.categories },
        { name: "groupId", label: t("group"), type: "select", options: opts.groups, hint: t("groupOrCustomerHint") },
        { name: "customerId", label: t("customer"), type: "select", options: opts.customers },
        { name: "discountBps", label: t("discountPct"), type: "bps", required: true },
        { name: "validFrom", label: t("validFrom"), type: "day" },
        { name: "validTo", label: t("validTo"), type: "day" },
      ]}
      columns={[
        { key: "category", label: t("category") },
        { key: "target", label: t("appliesTo") },
        { key: "discount", label: t("discountPct"), className: "num" },
        { key: "validity", label: t("validity"), className: "num" },
      ]}
      rows={rows.map((x) => ({
        id: x.id,
        values: { categoryId: x.categoryId, groupId: x.groupId ?? "", customerId: x.customerId ?? "", discountBps: pctInput(x.discountBps), validFrom: day(x.validFrom), validTo: day(x.validTo) },
        cells: {
          category: opts.categoryName.get(x.categoryId) ?? "",
          target: x.groupId ? `${t("group")}: ${opts.groupName.get(x.groupId) ?? ""}` : `${t("customer")}: ${opts.customerName.get(x.customerId ?? "") ?? ""}`,
          discount: `-${pct(x.discountBps)}`,
          validity: range(x.validFrom, x.validTo),
        },
      }))}
    />
  );
}
