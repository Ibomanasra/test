import { getTranslations } from "next-intl/server";
import { SubTabs } from "@/components/admin/SubTabs";
import { PageHeader } from "@/components/ui";

/** Tägliche Arbeit vorn, Regelwerk unter „إعدادات متقدمة“ */
const MAIN = [
  ["", "overview"],
  // Aktionen werden im Angebotszentrum gepflegt
  ["/admin/offers", "promotions"],
  ["customer-prices", "customerPrices"],
  ["bulk", "bulk"],
  ["preview", "preview"],
] as const;
const MORE = [
  ["groups", "groups"],
  ["price-lists", "priceLists"],
  ["tiers", "tiers"],
  ["category-discounts", "categoryDiscounts"],
  ["rounding", "rounding"],
  ["scheduled", "scheduled"],
  ["history", "history"],
] as const;

export default async function PricesLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin.prices");
  const tab = ([k, key]: readonly [string, string]) => ({ href: k.startsWith("/") ? k : k ? `/admin/prices/${k}` : "/admin/prices", label: t(`tabs.${key}`) });
  return (
    <div>
      <PageHeader title={t("title")} />
      <SubTabs tabs={MAIN.map(tab)} more={MORE.map(tab)} moreLabel={t("tabs.advanced")} />
      {children}
    </div>
  );
}
