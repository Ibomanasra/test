import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { LogoutButton } from "@/components/LogoutButton";
import { Alert, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/page-guards";

export const dynamic = "force-dynamic";

/** Fahreransicht (mobil). Inhalt folgt in Phase 5 – hier nur Zugang und Layout. */
export default async function DriverPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireStaffPage(locale);
  if (!hasPermission(auth.permissions, "delivery.driver")) return <Forbidden />;
  const t = await getTranslations("driver");
  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={auth.user.name} actions={<LogoutButton redirectTo="/admin/login" />} />
      {/* TODO(Phase 5): Tourenliste, Lieferung bestätigen (Unterschrift/Foto), Bargeld erfassen */}
      <Alert tone="blue">{t("coming")}</Alert>
    </main>
  );
}
