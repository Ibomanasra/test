import { getTranslations } from "next-intl/server";
import { SubTabs } from "@/components/admin/SubTabs";
import { PageHeader } from "@/components/ui";

export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin.documents");
  return (
    <div>
      <PageHeader title={t("title")} />
      <SubTabs
        tabs={[
          { href: "/admin/documents", label: t("tabs.invoices") },
          { href: "/admin/documents/credit-notes", label: t("tabs.creditNotes") },
          { href: "/admin/documents/print-jobs", label: t("tabs.printJobs") },
        ]}
      />
      {children}
    </div>
  );
}
