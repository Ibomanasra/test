import { hasPermission, isOrderEditable, type OrderStatusKey } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Forbidden } from "@/components/admin/Forbidden";
import { OrderActions } from "@/components/admin/OrderActions";
import { OrderItemsEditor } from "@/components/admin/OrderItemsEditor";
import { OrderStatusTimeline } from "@/components/shop/OrderStatusTimeline";
import { Alert, Badge, Card, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, day, money, pct } from "@/server/format";
import { getOrder } from "@/server/services/orders";
import { quoteEditorOptions } from "@/server/services/quote-options";

export default async function AdminOrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "order.view");
  if (!auth) return <Forbidden />;
  const o = await getOrder(id).catch(() => notFound());
  const [t, tAll, tp] = await Promise.all([getTranslations("admin.orders"), getTranslations(), getTranslations("admin.prices")]);
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(auth.permissions, p);
  const seeCost = can("price.view_cost");
  const addr = o.addressSnapshot as { recipient: string; city: string; street?: string; details?: string; zoneAr: string; zoneEn: string; phone: string };
  const editable = isOrderEditable(o.status as OrderStatusKey) && can("order.edit");
  const editorOpts = editable ? await quoteEditorOptions(locale) : null;
  const margin = o.subtotalNet > 0 ? Math.round(((o.subtotalNet - o.costTotal) * 10_000) / o.subtotalNet) : 0;
  return (
    <div className="space-y-6">
      <PageHeader
        title={<Num>{o.number}</Num>}
        subtitle={`${o.customer.displayName} · ${dateTimeText(o.placedAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{tAll(`orderStatus.${o.status}`)}</Badge>
            <Badge>{tAll(`channel.${o.channel}`)}</Badge>
            {can("order.print") ? (
              <>
                <a className="rounded-lg px-3 py-1 text-sm ring-1 ring-ink-300 hover:bg-ink-100" href={`/api/v1/documents/order-confirmation/${o.id}`} target="_blank" rel="noopener">{t("print.confirmation")}</a>
                <a className="rounded-lg px-3 py-1 text-sm ring-1 ring-ink-300 hover:bg-ink-100" href={`/api/v1/documents/pick-list/${o.id}`} target="_blank" rel="noopener">{t("print.pickList")}</a>
              </>
            ) : null}
          </div>
        }
      />
      <Card><OrderStatusTimeline status={o.status as OrderStatusKey} events={o.events.map((e) => ({ toStatus: e.toStatus, at: dateTimeText(e.createdAt) }))} /></Card>
      <OrderActions
        orderId={o.id}
        status={o.status}
        items={o.items.map((i) => ({ id: i.id, sku: i.skuSnapshot, name: locale === "ar" ? i.nameArSnapshot : i.nameEnSnapshot, open: i.qtyBase - i.qtyCancelledBase - i.qtyDeliveredBase }))}
        can={{ confirm: can("order.confirm"), status: can("order.status"), cancel: can("order.cancel") }}
      />
      {o.parentOrder ? <Alert tone="blue">{t("backorderOf")} <Link href={`/admin/orders/${o.parentOrder.id}`} className="num underline">{o.parentOrder.number}</Link></Alert> : null}
      {o.backorders.length ? (
        <Alert tone="blue">
          {t("hasBackorders")}{" "}
          {o.backorders.map((b) => <Link key={b.id} href={`/admin/orders/${b.id}`} className="num me-2 underline">{b.number}</Link>)}
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t("customer")}>
          <p><Link href={`/admin/customers/${o.customer.id}`} className="text-brand-700 hover:underline">{o.customer.displayName}</Link> <span className="num text-xs text-ink-500">{o.customer.number}</span></p>
          {o.customer.dealerNumber ? <p className="text-sm">{tAll("register.dealerNumber")}: <Num>{o.customer.dealerNumber}</Num></p> : null}
          {o.placedBy ? <p className="text-xs text-ink-500">{t("placedBy")}: {o.placedBy.name}</p> : null}
          {o.quote ? <p className="text-sm">{t("fromQuote")}: <Link href={`/admin/quotes/${o.quote.id}`} className="num underline">{o.quote.number}</Link></p> : null}
        </Card>
        <Card title={t("delivery")}>
          <p className="text-sm">{addr.recipient} · <Num>{addr.phone}</Num></p>
          <p className="text-sm text-ink-600">{locale === "ar" ? addr.zoneAr : addr.zoneEn} – {addr.city} {[addr.street, addr.details].filter(Boolean).join("، ")}</p>
          <p className="mt-2 text-sm">{t("deliveryDay")}: <Num>{day(o.requestedDeliveryDate)}</Num></p>
          {o.customerNote ? <p className="mt-2 rounded bg-amber-50 p-2 text-sm">{o.customerNote}</p> : null}
        </Card>
        <Card title={t("payment")}>
          <p className="text-sm">{tAll(`paymentMethod.${o.paymentMethod}`)}</p>
          <p className="text-sm text-ink-600">{t(`paymentStatus.${o.paymentStatus}`)}{o.paymentTermDays ? ` · ${t("terms", { days: o.paymentTermDays })}` : ""}</p>
          {o.invoices.map((inv) => (
            <p key={inv.id} className="text-sm"><a href={`/api/v1/documents/invoice/${inv.id}`} target="_blank" rel="noopener" className="num text-brand-700 underline">{inv.number}</a> · <span className="num">{money(inv.totalGross)}</span></p>
          ))}
        </Card>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>{t("product")}</Th>
            <Th>{t("qty")}</Th>
            <Th>{t("unitNet")}</Th>
            <Th>{t("lineNet")}</Th>
            <Th>{t("rule")}</Th>
            {seeCost ? <Th>{t("cost")}</Th> : null}
            <Th>{t("progress")}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {o.items.map((i) => (
            <tr key={i.id} className={i.belowMargin && seeCost ? "bg-amber-50" : undefined} data-testid="order-item">
              <Td className="num">{i.skuSnapshot}</Td>
              <Td>{locale === "ar" ? i.nameArSnapshot : i.nameEnSnapshot}{i.freeQtyBase > 0 ? <span className="block text-xs text-green-700">{tAll("shop.cart.freeUnits", { count: i.freeQtyBase })}</span> : null}</Td>
              <Td className="num">{i.qty} × {tAll(`units.${i.unitCode}`)} ({i.unitFactor})</Td>
              <Td className="num">{money(i.unitPriceNet)}</Td>
              <Td className="num">{money(i.lineNet)}</Td>
              <Td className="text-xs">{tp(`rules.${i.priceRule}`)}{i.belowMargin && seeCost ? <span className="ms-1"><Badge tone="amber">{tp("belowMarginBadge")}</Badge></span> : null}</Td>
              {seeCost ? <Td className="num">{money(i.unitCost)}</Td> : null}
              <Td className="num text-xs">{t("progressValue", { delivered: i.qtyDeliveredBase, cancelled: i.qtyCancelledBase, total: i.qtyBase })}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editable && editorOpts ? (
        <OrderItemsEditor
          orderId={o.id}
          channel={o.channel}
          canEditPrice={can("order.edit_price")}
          skuOptions={editorOpts.skuOptions}
          unitNames={editorOpts.unitNames}
          initial={o.items.map((i) => ({ sku: i.skuSnapshot, unitCode: i.unitCode, qty: String(i.qty), manual: "" }))}
        />
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("shipments")}>
          {o.shipments.length === 0 ? <p className="text-sm text-ink-500">–</p> : null}
          <ul className="space-y-1 text-sm">
            {o.shipments.map((s) => (
              <li key={s.id}>
                <a href={`/api/v1/documents/delivery-note/${s.id}`} target="_blank" rel="noopener" className="num text-brand-700 underline">{s.number}</a> · {t(`shipmentStatus.${s.status}`)} · <Num>{dateTimeText(s.deliveredAt ?? s.createdAt)}</Num>
                {s.receivedByName ? ` · ${s.receivedByName}` : ""}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="ms-auto max-w-xs space-y-1 text-sm">
            {o.deliveryFeeGross > 0 ? <p className="flex justify-between"><span>{t("deliveryFee")}</span><span className="num">{money(o.deliveryFeeGross)}</span></p> : null}
            <p className="flex justify-between"><span>{t("net")}</span><span className="num">{money(o.subtotalNet)}</span></p>
            <p className="flex justify-between"><span>{t("vat")}</span><span className="num">{money(o.vatTotal)}</span></p>
            <p className="flex justify-between font-bold"><span>{t("total")}</span><span className="num" data-testid="order-total">{money(o.totalGross)}</span></p>
            {seeCost ? <p className="flex justify-between text-ink-500"><span>{t("margin")}</span><span className="num">{money(o.subtotalNet - o.costTotal)} ({pct(margin)})</span></p> : null}
          </div>
        </Card>
      </div>
      <Card title={t("history")}>
        <ul className="space-y-1 text-sm">
          {o.events.map((e) => (
            <li key={e.id}><Num>{dateTimeText(e.createdAt)}</Num> · {tAll(`orderStatus.${e.toStatus}`)} · {e.byUser?.name ?? "–"}{e.note ? ` · ${e.note}` : ""}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm"><Link href={`/admin/audit?entityType=Order&entityId=${o.id}`} className="text-brand-700 underline">{tAll("admin.nav.audit")}</Link></p>
      </Card>
    </div>
  );
}
