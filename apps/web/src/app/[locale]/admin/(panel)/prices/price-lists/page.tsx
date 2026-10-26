import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { day, money, moneyInput, range } from "@/server/format";
import { priceOptions } from "@/server/services/price-options";
import { pricePage } from "../guard";

export default async function PriceListsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale);
  if (!g) return <Forbidden />;
  const [t, tc, opts, lists, items] = await Promise.all([
    getTranslations("admin.prices"),
    getTranslations("common"),
    priceOptions(locale),
    prisma.priceList.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { items: true, groups: true } } } }),
    prisma.priceListItem.findMany({ orderBy: [{ priceListId: "asc" }], include: { variant: { select: { sku: true } } } }),
  ]);
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("tabs.priceLists")}</h2>
        <CrudManager
          endpoint="/api/v1/admin/prices/rules/price-lists"
          canEdit={g.canEdit}
          createLabel={t("newPriceList")}
          defaults={{ active: true }}
          fields={[
            { name: "code", label: t("code"), type: "text", required: true, dir: "ltr" },
            { name: "nameAr", label: t("nameAr"), type: "text", required: true, dir: "rtl" },
            { name: "nameEn", label: t("nameEn"), type: "text", required: true, dir: "ltr" },
            { name: "active", label: tc("active"), type: "checkbox" },
          ]}
          columns={[
            { key: "code", label: t("code"), className: "num" },
            { key: "name", label: tc("name") },
            { key: "items", label: t("items"), className: "num" },
            { key: "groups", label: t("tabs.groups"), className: "num" },
          ]}
          rows={lists.map((l) => ({
            id: l.id,
            tone: l.active ? undefined : "muted",
            values: { code: l.code, nameAr: l.nameAr, nameEn: l.nameEn, active: l.active },
            cells: { code: l.code, name: locale === "ar" ? l.nameAr : l.nameEn, items: String(l._count.items), groups: String(l._count.groups) },
          }))}
        />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("items")}</h2>
        <CrudManager
          endpoint="/api/v1/admin/prices/rules/price-list-items"
          canEdit={g.canEdit && lists.length > 0}
          createLabel={t("newPriceListItem")}
          skuOptions={opts.skuOptions}
          fields={[
            { name: "priceListId", label: t("priceList"), type: "select", required: true, options: opts.priceLists },
            { name: "sku", label: t("sku"), type: "sku", required: true },
            { name: "priceNet", label: t("priceNet"), type: "money", required: true },
            { name: "validFrom", label: t("validFrom"), type: "day" },
            { name: "validTo", label: t("validTo"), type: "day" },
          ]}
          columns={[
            { key: "list", label: t("priceList") },
            { key: "variant", label: t("product") },
            { key: "price", label: t("priceNet"), className: "num" },
            { key: "validity", label: t("validity"), className: "num" },
          ]}
          rows={items.map((i) => ({
            id: i.id,
            values: { priceListId: i.priceListId, sku: i.variant.sku, priceNet: moneyInput(i.priceNet), validFrom: day(i.validFrom), validTo: day(i.validTo) },
            cells: { list: opts.priceListName.get(i.priceListId) ?? "", variant: opts.variantLabel.get(i.variantId) ?? i.variant.sku, price: money(i.priceNet), validity: range(i.validFrom, i.validTo) },
          }))}
        />
      </section>
    </div>
  );
}
