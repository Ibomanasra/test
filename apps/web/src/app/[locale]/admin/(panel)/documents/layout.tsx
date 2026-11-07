import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";

export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin.documents");
  return (
    <div>
      <PageHeader title={t("title")} />
      {children}
    </div>
  );
}
