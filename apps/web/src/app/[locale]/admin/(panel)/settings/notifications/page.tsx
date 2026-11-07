import { hasPermission } from "@sa/core";
import { setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { TelegramSettings } from "@/components/admin/TelegramSettings";
import { PushToggle } from "@/components/notifications/PushToggle";
import { staffPagePermission } from "@/server/auth/page-guards";
import { telegramStatus } from "@/server/services/notify-settings";

export const dynamic = "force-dynamic";

/** Einstellungen → Benachrichtigungen: Telegram (kostenlos) + Browser-Push dieses Geräts */
export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "settings.view");
  if (!auth) return <Forbidden />;
  const status = await telegramStatus();
  return (
    <div className="space-y-6">
      <TelegramSettings initial={status} canEdit={hasPermission(auth.permissions, "settings.edit")} />
      <PushToggle />
    </div>
  );
}
