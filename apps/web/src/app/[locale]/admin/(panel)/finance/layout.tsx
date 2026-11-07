import { getTranslations } from "next-intl/server";
import { SubTabs } from "@/components/admin/SubTabs";
import { PageHeader } from "@/components/ui";

/** Einfach: Übersicht → Wer schuldet uns? → Zahlungen → Rechnungen; Seltenes unter „mehr“ */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin.finance");
  return (
    <div>
      <PageHeader title={t("title")} />
      <SubTabs
        tabs={[
          { href: "/admin/finance", label: t("tabs.overview") },
          { href: "/admin/finance/open", label: t("tabs.openItems") },
          { href: "/admin/finance/payments", label: t("tabs.payments") },
          { href: "/admin/documents", label: t("tabs.invoices") },
        ]}
        more={[
          { href: "/admin/finance/returns", label: t("tabs.returns") },
          { href: "/admin/finance/dunning", label: t("tabs.dunning") },
          { href: "/admin/finance/exports", label: t("tabs.exports") },
        ]}
        moreLabel={t("tabs.more")}
      />
      {children}
    </div>
  );
}
