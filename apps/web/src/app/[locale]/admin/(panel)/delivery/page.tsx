import { businessDate, hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { TourPlanner } from "@/components/admin/TourPlanner";
import { Badge, Button, EmptyState, Input, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { listDrivers, listTours } from "@/server/services/delivery";
import { shipmentOptions } from "@/server/services/delivery-view";
import { listZones } from "@/server/services/settings";

export default async function DeliveryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ date?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "delivery.plan", "delivery.view_all", "delivery.cash_closing");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  const canPlan = hasPermission(auth.permissions, "delivery.plan");
  const [t, tc, tours, drivers, zones, shipments] = await Promise.all([
    getTranslations("admin.delivery"),
    getTranslations("common"),
    listTours({ date }),
    canPlan ? listDrivers() : Promise.resolve([]),
    canPlan ? listZones(true) : Promise.resolve([]),
    canPlan ? shipmentOptions(locale) : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-6">
      {canPlan ? (
        <TourPlanner
          today={businessDate(new Date())}
          shipments={shipments}
          drivers={drivers.map((d) => ({ value: d.id, label: d.name }))}
          zones={zones.map((z) => ({ value: z.id, label: locale === "ar" ? z.nameAr : z.nameEn }))}
        />
      ) : null}
      <form method="get" className="flex gap-2">
        <Input name="date" type="date" dir="ltr" defaultValue={date} className="num w-auto" aria-label={t("date")} />
        <Button type="submit" variant="secondary">{tc("filter")}</Button>
      </form>
      {tours.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>{tc("number")}</Th><Th>{t("date")}</Th><Th>{t("driver")}</Th><Th>{t("zone")}</Th><Th>{tc("status")}</Th><Th>{t("stops")}</Th><Th>{t("cod")}</Th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {tours.map((x) => (
              <tr key={x.id} data-testid="tour-row">
                <Td><Link href={`/admin/delivery/tours/${x.id}`} className="num font-medium text-brand-700 hover:underline">{x.number}</Link></Td>
                <Td className="num">{day(x.date)}</Td>
                <Td>{x.driver?.name ?? "–"}</Td>
                <Td>{x.zone ? (locale === "ar" ? x.zone.nameAr : x.zone.nameEn) : "–"}</Td>
                <Td><Badge>{t(`tourStatus.${x.status}`)}</Badge></Td>
                <Td className="num">{x.stops.filter((s) => s.status !== "PENDING").length} / {x.stops.length}</Td>
                <Td className="num">{money(x.stops.reduce((a, s) => a + s.codExpected, 0))}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
