import { getTranslations } from "next-intl/server";
import { SubTabs } from "@/components/admin/SubTabs";
import { PageHeader } from "@/components/ui";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin.finance");
  return (
    <div>
      <PageHeader title={t("title")} />
      <SubTabs
        tabs={[
          { href: "/admin/finance", label: t("tabs.openItems") },
          { href: "/admin/finance/payments", label: t("tabs.payments") },
          { href: "/admin/finance/dunning", label: t("tabs.dunning") },
          { href: "/admin/finance/returns", label: t("tabs.returns") },
          { href: "/admin/finance/exports", label: t("tabs.exports") },
          { href: "/admin/documents", label: t("tabs.invoices") },
        ]}
      />
      {children}
    </div>
  );
}
