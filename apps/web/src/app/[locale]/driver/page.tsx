import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { CashClosingForm, DriverStop } from "@/components/driver/DriverStop";
import { LogoutButton } from "@/components/LogoutButton";
import { PrintButton } from "@/components/print/PrintButton";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { driverCash, driverTours } from "@/server/services/delivery";

export const dynamic = "force-dynamic";

/** Fahreransicht (mobil): eigene Touren, Zustellung mit Unterschrift und Bargeld, Kassenabschluss */
export default async function DriverPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireStaffPage(locale);
  if (!hasPermission(auth.permissions, "delivery.driver")) return <Forbidden />;
  const [t, tours, cash] = await Promise.all([getTranslations("driver"), driverTours(auth.user.id), driverCash(auth.user.id)]);
  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={auth.user.name} actions={<LogoutButton redirectTo="/admin/login" />} />
      {tours.length === 0 ? <EmptyState>{t("noTours")}</EmptyState> : null}
      {tours.map((tour) => (
        <section key={tour.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold"><span className="num">{tour.number}</span> · <span className="num">{day(tour.date)}</span></h2>
            <PrintButton href={`/api/v1/documents/tour-sheet/${tour.id}`} label="PDF" />
          </div>
          {tour.stops.map((s) => {
            const a = (s.shipment.order.addressSnapshot ?? {}) as { recipient?: string; phone?: string; city?: string; street?: string; details?: string };
            const phone = a.phone ?? s.shipment.order.customer.phone ?? "";
            return (
              <Card key={s.id}>
                <div className="space-y-2" data-testid="driver-stop">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium"><span className="num">{s.sequence}.</span> {s.shipment.order.customer.displayName}</p>
                      <p className="text-sm text-ink-600">{[a.city, a.street, a.details].filter(Boolean).join("، ")}</p>
                      <p className="num text-xs text-ink-500">{s.shipment.number} · {s.shipment.order.number}</p>
                    </div>
                    <Badge tone={s.status === "DELIVERED" ? "green" : s.status === "FAILED" ? "red" : "neutral"}>{t(`stop.${s.status}`)}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {phone ? <a href={`tel:${phone}`} className="num rounded-lg px-3 py-1.5 ring-1 ring-ink-300">📞 {phone}</a> : null}
                    {a.city ? <a href={`https://maps.google.com/?q=${encodeURIComponent([a.street, a.city].filter(Boolean).join(", "))}`} target="_blank" rel="noopener" className="rounded-lg px-3 py-1.5 ring-1 ring-ink-300">🗺 {t("map")}</a> : null}
                    <a href={`/api/v1/documents/delivery-note/${s.shipmentId}`} target="_blank" rel="noopener" className="rounded-lg px-3 py-1.5 ring-1 ring-ink-300">🖨 {t("deliveryNote")}</a>
                  </div>
                  {s.codExpected > 0 && s.status === "PENDING" ? <p className="text-sm font-semibold text-brand-800">{t("collect")}: <span className="num">{money(s.codExpected)}</span></p> : null}
                  {s.status === "PENDING" ? <DriverStop stopId={s.id} codExpected={s.codExpected} codLabel="₪" /> : null}
                  {s.failReason ? <p className="text-sm text-red-700">{s.failReason}</p> : null}
                </div>
              </Card>
            );
          })}
        </section>
      ))}
      <Card title={t("cashTitle")}>
        <p className="mb-3 text-sm">{t("openCash")}: <span className="num font-semibold" data-testid="driver-cash">{money(cash.expected)}</span> ({cash.collections.length})</p>
        <CashClosingForm expected={cash.expected} />
      </Card>
    </main>
  );
}
