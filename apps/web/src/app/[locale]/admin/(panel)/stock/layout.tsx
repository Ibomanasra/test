import { getTranslations } from "next-intl/server";
import { SubTabs } from "@/components/admin/SubTabs";
import { PageHeader } from "@/components/ui";

export default async function StockLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin.stock");
  return (
    <div>
      <PageHeader title={t("title")} />
      <SubTabs
        tabs={[
          { href: "/admin/stock", label: t("tabs.levels") },
          { href: "/admin/stock/movements", label: t("tabs.movements") },
          { href: "/admin/stock/stocktakes", label: t("tabs.stocktakes") },
          { href: "/admin/stock/bins", label: t("tabs.bins") },
        ]}
      />
      {children}
    </div>
  );
}
