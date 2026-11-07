import { hasPermission } from "@sa/core";
import { setRequestLocale } from "next-intl/server";
import { DeliveryCompaniesManager } from "@/components/admin/DeliveryCompaniesManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listDeliveryCompanies } from "@/server/services/delivery-companies";
import { ownDriversEnabled } from "@/server/services/delivery-mode";

export default async function DeliveryCompaniesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "settings.view");
  if (!auth) return <Forbidden />;
  const [items, ownDrivers] = await Promise.all([listDeliveryCompanies(), ownDriversEnabled()]);
  return (
    <DeliveryCompaniesManager
      canEdit={hasPermission(auth.permissions, "settings.edit")}
      ownDrivers={ownDrivers}
      items={items.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? "", note: c.note ?? "", active: c.active, open: c._count.shipments }))}
    />
  );
}
