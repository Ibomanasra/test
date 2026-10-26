import { getTranslations } from "next-intl/server";
import { SubTabs } from "@/components/admin/SubTabs";
import { PageHeader } from "@/components/ui";

const TABS = ["", "groups", "price-lists", "tiers", "customer-prices", "category-discounts", "promotions", "rounding", "scheduled", "bulk", "history", "preview"] as const;
const KEYS: Record<(typeof TABS)[number], string> = {
  "": "overview",
  groups: "groups",
  "price-lists": "priceLists",
  tiers: "tiers",
  "customer-prices": "customerPrices",
  "category-discounts": "categoryDiscounts",
  promotions: "promotions",
  rounding: "rounding",
  scheduled: "scheduled",
  bulk: "bulk",
  history: "history",
  preview: "preview",
};

export default async function PricesLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin.prices");
  return (
    <div>
      <PageHeader title={t("title")} />
      <SubTabs tabs={TABS.map((k) => ({ href: k ? `/admin/prices/${k}` : "/admin/prices", label: t(`tabs.${KEYS[k]}`) }))} />
      {children}
    </div>
  );
}
