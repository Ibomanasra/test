import { getTranslations } from "next-intl/server";
import { SubTabs } from "@/components/admin/SubTabs";
import { PageHeader } from "@/components/ui";

export default async function PurchasingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin.purchasing");
  return (
    <div>
      <PageHeader title={t("title")} />
      <SubTabs tabs={[{ href: "/admin/purchasing", label: t("tabs.orders") }, { href: "/admin/purchasing/suppliers", label: t("tabs.suppliers") }]} />
      {children}
    </div>
  );
}
