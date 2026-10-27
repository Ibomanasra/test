import { getTranslations } from "next-intl/server";
import { SubTabs } from "@/components/admin/SubTabs";
import { PageHeader } from "@/components/ui";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin.delivery");
  return (
    <div>
      <PageHeader title={t("title")} />
      <SubTabs tabs={[{ href: "/admin/delivery", label: t("tabs.tours") }, { href: "/admin/delivery/cash", label: t("tabs.cash") }]} />
      {children}
    </div>
  );
}
