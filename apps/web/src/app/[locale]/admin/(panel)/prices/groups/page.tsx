import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { money, moneyInput, pct, pctInput } from "@/server/format";
import { priceOptions } from "@/server/services/price-options";
import { pricePage } from "../guard";

export default async function GroupsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale);
  if (!g) return <Forbidden />;
  const [t, tc, opts, groups] = await Promise.all([
    getTranslations("admin.prices"),
    getTranslations("common"),
    priceOptions(locale),
    prisma.customerGroup.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { customers: true } } } }),
  ]);
  return (
    <CrudManager
      endpoint="/api/v1/admin/prices/rules/groups"
      canEdit={g.canEdit}
      createLabel={t("newGroup")}
      defaults={{ pricingMode: "DISCOUNT_PERCENT", active: true, sortOrder: "0", discountBps: "0" }}
      fields={[
        { name: "code", label: t("code"), type: "text", required: true, dir: "ltr" },
        { name: "nameAr", label: t("nameAr"), type: "text", required: true, dir: "rtl" },
        { name: "nameEn", label: t("nameEn"), type: "text", required: true, dir: "ltr" },
        { name: "pricingMode", label: t("pricingMode"), type: "select", required: true, options: [{ value: "DISCOUNT_PERCENT", label: t("mode.DISCOUNT_PERCENT") }, { value: "PRICE_LIST", label: t("mode.PRICE_LIST") }] },
        { name: "discountBps", label: t("discountPct"), type: "bps", showIf: { field: "pricingMode", in: ["DISCOUNT_PERCENT"] } },
        { name: "priceListId", label: t("priceList"), type: "select", options: opts.priceLists, showIf: { field: "pricingMode", in: ["PRICE_LIST"] } },
        { name: "defaultPaymentTermDays", label: t("defaultTerms"), type: "int" },
        { name: "defaultCreditLimitAgorot", label: t("defaultCredit"), type: "money" },
        { name: "sortOrder", label: t("sortOrder"), type: "int" },
        { name: "active", label: tc("active"), type: "checkbox" },
      ]}
      columns={[
        { key: "code", label: t("code"), className: "num" },
        { key: "name", label: tc("name") },
        { key: "mode", label: t("pricingMode") },
        { key: "terms", label: t("defaultTerms"), className: "num" },
        { key: "credit", label: t("defaultCredit"), className: "num" },
        { key: "customers", label: t("customersCount"), className: "num" },
        { key: "active", label: tc("status") },
      ]}
      rows={groups.map((x) => ({
        id: x.id,
        tone: x.active ? undefined : "muted",
        values: {
          code: x.code,
          nameAr: x.nameAr,
          nameEn: x.nameEn,
          pricingMode: x.pricingMode,
          discountBps: pctInput(x.discountBps),
          priceListId: x.priceListId ?? "",
          defaultPaymentTermDays: x.defaultPaymentTermDays?.toString() ?? "",
          defaultCreditLimitAgorot: moneyInput(x.defaultCreditLimitAgorot),
          sortOrder: String(x.sortOrder),
          active: x.active,
        },
        cells: {
          code: x.code,
          name: locale === "ar" ? x.nameAr : x.nameEn,
          mode: x.pricingMode === "PRICE_LIST" ? `${t("mode.PRICE_LIST")}: ${opts.priceListName.get(x.priceListId ?? "") ?? "–"}` : `${t("mode.DISCOUNT_PERCENT")}: ${pct(x.discountBps)}`,
          terms: x.defaultPaymentTermDays?.toString() ?? "–",
          credit: money(x.defaultCreditLimitAgorot),
          customers: String(x._count.customers),
          active: x.active ? tc("active") : tc("inactive"),
        },
      }))}
    />
  );
}
