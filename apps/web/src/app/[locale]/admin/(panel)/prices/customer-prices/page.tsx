import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { day, money, moneyInput, range } from "@/server/format";
import { priceOptions } from "@/server/services/price-options";
import { pricePage } from "../guard";

export default async function CustomerPricesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale);
  if (!g) return <Forbidden />;
  const [t, tc, opts, rows] = await Promise.all([
    getTranslations("admin.prices"),
    getTranslations("common"),
    priceOptions(locale),
    prisma.customerPrice.findMany({ orderBy: [{ customerId: "asc" }], include: { variant: { select: { sku: true } } } }),
  ]);
  return (
    <CrudManager
      endpoint="/api/v1/admin/prices/rules/customer-prices"
      canEdit={g.canEdit}
      createLabel={t("newCustomerPrice")}
      skuOptions={opts.skuOptions}
      fields={[
        { name: "customerId", label: t("customer"), type: "select", required: true, options: opts.customers },
        { name: "sku", label: t("sku"), type: "sku", required: true },
        { name: "priceNet", label: t("priceNet"), type: "money", required: true },
        { name: "validFrom", label: t("validFrom"), type: "day" },
        { name: "validTo", label: t("validTo"), type: "day" },
        { name: "isFixed", label: t("fixed"), type: "checkbox" },
        { name: "note", label: tc("notes"), type: "text" },
      ]}
      columns={[
        { key: "customer", label: t("customer") },
        { key: "variant", label: t("product") },
        { key: "price", label: t("priceNet"), className: "num" },
        { key: "fixed", label: t("fixed") },
        { key: "validity", label: t("validity"), className: "num" },
        { key: "note", label: tc("notes") },
      ]}
      rows={rows.map((x) => ({
        id: x.id,
        values: { customerId: x.customerId, sku: x.variant.sku, priceNet: moneyInput(x.priceNet), validFrom: day(x.validFrom), validTo: day(x.validTo), isFixed: x.isFixed, note: x.note ?? "" },
        cells: {
          customer: opts.customerName.get(x.customerId) ?? "",
          variant: opts.variantLabel.get(x.variantId) ?? x.variant.sku,
          price: money(x.priceNet),
          fixed: x.isFixed ? tc("yes") : tc("no"),
          validity: range(x.validFrom, x.validTo),
          note: x.note ?? "",
        },
      }))}
    />
  );
}
