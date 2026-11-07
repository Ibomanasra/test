import { hasPermission } from "@sa/core";
import { setRequestLocale } from "next-intl/server";
import { CourierAccounts } from "@/components/admin/CourierAccounts";
import { Forbidden } from "@/components/admin/Forbidden";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, day } from "@/server/format";
import { courierAccounts } from "@/server/services/delivery-companies";

export const dynamic = "force-dynamic";

/** Finanzen → Zustellfirmen: kassiertes Nachnahme-Geld, das uns die Firmen noch geben müssen */
export default async function CourierAccountsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "finance.view");
  if (!auth) return <Forbidden />;
  const accounts = await courierAccounts();
  return (
    <CourierAccounts
      canSettle={hasPermission(auth.permissions, "finance.payment")}
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        phone: a.phone ?? "",
        owed: a.owed,
        onTheWay: a.onTheWay,
        onTheWayCount: a.onTheWayCount,
        items: a.owedItems.map((s) => ({
          id: s.id,
          orderId: s.order.id,
          orderNumber: s.order.number,
          customer: s.order.customer.displayName,
          tracking: s.trackingNumber ?? "",
          deliveredAt: s.deliveredAt ? day(s.deliveredAt) : "",
          amount: s.codAmount ?? 0,
        })),
        settlements: a.settlements.map((x) => ({ id: x.id, at: dateTimeText(x.createdAt), amount: x.amount, count: x._count.shipments, note: x.note ?? "" })),
      }))}
    />
  );
}
