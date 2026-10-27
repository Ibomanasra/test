import type { OrderStatusKey } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print/PrintButton";
import { PayNowButton } from "@/components/shop/PaymentButtons";
import { CartActionButton } from "@/components/shop/ReorderButton";
import { OrderStatusTimeline } from "@/components/shop/OrderStatusTimeline";
import { Alert, Card, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { dateTimeText, day, money } from "@/server/format";
import { getOrder } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export default async function MyOrderPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await requireCustomerPage(locale, `/account/orders/${id}`);
  const o = await getOrder(id, auth.customer!.id).catch(() => notFound());
  const [t, tAll, sp] = await Promise.all([getTranslations("account.orders"), getTranslations(), searchParams]);
  const addr = o.addressSnapshot as { recipient: string; city: string; street?: string; details?: string; zoneAr: string; zoneEn: string; phone: string };
  return (
    <div className="space-y-6">
      {sp.placed ? <Alert tone="green">{t("placed", { number: o.number })}</Alert> : null}
      <PageHeader
        title={<Num>{o.number}</Num>}
        subtitle={dateTimeText(o.placedAt)}
        actions={
          <div className="flex flex-wrap gap-2">
            <PrintButton href={`/api/v1/documents/order-confirmation/${o.id}`} label={t("confirmationPdf")} testId="print-confirmation" />
            {o.invoices.map((inv) => <PrintButton key={inv.id} href={`/api/v1/documents/invoice/${inv.id}`} label={`${t("invoicePdf")} ${inv.number}`} />)}
            {o.paymentMethod === "CARD_GATEWAY" && o.paymentStatus !== "PAID" && o.status === "NEW" ? <PayNowButton orderId={o.id} /> : null}
            <CartActionButton endpoint="/api/v1/cart/reorder" body={{ orderId: o.id }} label={t("reorder")} testId="reorder" />
          </div>
        }
      />
      <Card><OrderStatusTimeline status={o.status as OrderStatusKey} events={o.events.map((e) => ({ toStatus: e.toStatus, at: dateTimeText(e.createdAt) }))} /></Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title={t("delivery")}>
          <p className="text-sm">{addr.recipient} · <Num>{addr.phone}</Num></p>
          <p className="text-sm text-ink-600">{locale === "ar" ? addr.zoneAr : addr.zoneEn} – {addr.city} {[addr.street, addr.details].filter(Boolean).join("، ")}</p>
          <p className="mt-2 text-sm">{t("requestedDay")}: <Num>{day(o.requestedDeliveryDate)}</Num></p>
        </Card>
        <Card title={t("payment")}>
          <p className="text-sm">{tAll(`paymentMethod.${o.paymentMethod}`)}</p>
          {o.paymentTermDays ? <p className="text-sm text-ink-600">{t("terms", { days: o.paymentTermDays })}</p> : null}
          {o.customerNote ? <p className="mt-2 text-sm text-ink-600">{o.customerNote}</p> : null}
        </Card>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>{t("product")}</Th>
            <Th>{t("qty")}</Th>
            <Th>{o.channel === "B2B" ? t("unitNet") : t("unitGross")}</Th>
            <Th>{t("lineTotal")}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {o.items.map((i) => (
            <tr key={i.id}>
              <Td>{locale === "ar" ? i.nameArSnapshot : i.nameEnSnapshot}<p className="num text-xs text-ink-500">{i.skuSnapshot}</p>{i.freeQtyBase > 0 ? <p className="text-xs text-green-700">{tAll("shop.cart.freeUnits", { count: i.freeQtyBase })}</p> : null}</Td>
              <Td className="num">{i.qty} × {tAll(`units.${i.unitCode}`)}{i.unitFactor > 1 ? ` (${i.unitFactor})` : ""}{i.qtyCancelledBase > 0 ? <span className="block text-xs text-amber-700">−{i.qtyCancelledBase}</span> : null}</Td>
              <Td className="num">{money(o.channel === "B2B" ? i.unitPriceNet : i.unitPriceGross)}</Td>
              <Td className="num">{money(o.channel === "B2B" ? i.lineNet : i.lineGross)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card>
        <div className="ms-auto max-w-xs space-y-1 text-sm">
          {o.deliveryFeeGross > 0 ? <p className="flex justify-between"><span>{t("deliveryFee")}</span><span className="num">{money(o.deliveryFeeGross)}</span></p> : null}
          <p className="flex justify-between"><span>{t("net")}</span><span className="num">{money(o.subtotalNet)}</span></p>
          <p className="flex justify-between"><span>{t("vat")}</span><span className="num">{money(o.vatTotal)}</span></p>
          <p className="flex justify-between font-bold"><span>{t("total")}</span><span className="num">{money(o.totalGross)}</span></p>
        </div>
      </Card>
      {o.backorders.length ? <Alert tone="blue">{t("backorder", { numbers: o.backorders.map((b) => b.number).join(", ") })}</Alert> : null}
    </div>
  );
}
