import { hasPermission } from "@sa/core";
import { setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { PaymentMethodsEditor } from "@/components/admin/PaymentMethodsEditor";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listPaymentMethods } from "@/server/services/settings";

export default async function PaymentMethodsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "settings.view");
  if (!auth) return <Forbidden />;
  const rows = await listPaymentMethods();
  return (
    <PaymentMethodsEditor
      canEdit={hasPermission(auth.permissions, "settings.edit")}
      rows={rows.map((r) => ({ id: r.id, method: r.method, channel: r.channel, enabled: r.enabled, labelAr: r.labelAr, labelEn: r.labelEn, sortOrder: r.sortOrder }))}
    />
  );
}
