import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiButton } from "@/components/admin/ApiForm";
import { Forbidden } from "@/components/admin/Forbidden";
import { AddStops } from "@/components/admin/TourPlanner";
import { PrintButton } from "@/components/print/PrintButton";
import { Badge, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { getTour } from "@/server/services/delivery";
import { shipmentOptions } from "@/server/services/delivery-view";

export default async function TourPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "delivery.plan", "delivery.view_all");
  if (!auth) return <Forbidden />;
  const tour = await getTour(id).catch(() => notFound());
  const canPlan = hasPermission(auth.permissions, "delivery.plan");
  const editable = canPlan && tour.status !== "COMPLETED" && tour.status !== "CLOSED";
  const [t, shipments] = await Promise.all([getTranslations("admin.delivery"), editable ? shipmentOptions(locale) : Promise.resolve([])]);
  const ids = tour.stops.map((s) => s.id);
  const moved = (i: number, d: -1 | 1) => {
    const n = [...ids];
    [n[i], n[i + d]] = [n[i + d]!, n[i]!];
    return n;
  };
  const cod = tour.stops.reduce((a, s) => a + s.codExpected, 0);
  const collected = tour.stops.reduce((a, s) => a + s.collections.reduce((b, c) => b + c.amount, 0), 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="num text-xl font-semibold">{tour.number}</h2>
        <Badge>{t(`tourStatus.${tour.status}`)}</Badge>
        <span className="text-sm text-ink-600">{day(tour.date)} · {tour.driver?.name ?? "–"}</span>
        <span className="ms-auto flex flex-wrap gap-2">
          <PrintButton href={`/api/v1/documents/tour-sheet/${tour.id}`} testId="print-tour" />
          {editable && tour.status === "PLANNED" ? <ApiButton endpoint={`/api/v1/admin/tours/${tour.id}/status`} body={{ status: "LOADED" }} label={t("markLoaded")} /> : null}
        </span>
      </div>
      <p className="text-sm">{t("codTotal")}: <span className="num font-semibold">{money(cod)}</span> · {t("collected")}: <span className="num font-semibold">{money(collected)}</span></p>
      <Table>
        <thead><tr><Th>#</Th><Th>{t("deliveryNote")}</Th><Th>{t("customer")}</Th><Th>{t("address")}</Th><Th>{t("cod")}</Th><Th>{t("stopStatus")}</Th><Th /></tr></thead>
        <tbody className="divide-y divide-ink-100">
          {tour.stops.map((s, i) => {
            const a = (s.shipment.order.addressSnapshot ?? {}) as { city?: string; street?: string; details?: string; phone?: string };
            return (
              <tr key={s.id} data-testid="tour-stop">
                <Td className="num">{s.sequence}</Td>
                <Td><span className="num">{s.shipment.number}</span><Link href={`/admin/orders/${s.shipment.order.id}`} className="num block text-xs text-brand-700">{s.shipment.order.number}</Link></Td>
                <Td>{s.shipment.order.customer.displayName}<span className="num block text-xs text-ink-500">{a.phone ?? s.shipment.order.customer.phone ?? ""}</span></Td>
                <Td className="text-sm">{[a.city, a.street, a.details].filter(Boolean).join("، ")}</Td>
                <Td className="num">{s.codExpected ? money(s.codExpected) : "–"}</Td>
                <Td><Badge tone={s.status === "DELIVERED" ? "green" : s.status === "FAILED" ? "red" : "neutral"}>{t(`stopStatusType.${s.status}`)}</Badge>{s.failReason ? <span className="block text-xs text-red-700">{s.failReason}</span> : null}</Td>
                <Td>
                  {editable && s.status === "PENDING" ? (
                    <span className="flex gap-1">
                      {i > 0 ? <ApiButton endpoint={`/api/v1/admin/tours/${tour.id}/stops`} method="PUT" body={{ stopIds: moved(i, -1) }} label="↑" variant="ghost" /> : null}
                      {i < ids.length - 1 ? <ApiButton endpoint={`/api/v1/admin/tours/${tour.id}/stops`} method="PUT" body={{ stopIds: moved(i, 1) }} label="↓" variant="ghost" /> : null}
                      <ApiButton endpoint={`/api/v1/admin/tour-stops/${s.id}`} method="DELETE" label="✕" variant="ghost" confirmText={t("removeStopConfirm")} />
                    </span>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {editable ? <AddStops tourId={tour.id} shipments={shipments} /> : null}
    </div>
  );
}
