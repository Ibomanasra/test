import { getTranslations } from "next-intl/server";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { PageHeader } from "@/components/ui";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin.settings");
  return (
    <div>
      <PageHeader title={t("title")} />
      <SettingsTabs />
      {children}
    </div>
  );
}
