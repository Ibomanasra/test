import { orderListQuerySchema } from "@sa/contracts";
import { ORDER_STATUSES, startOfBusinessDay } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { OrderSelection } from "@/components/admin/OrderSelection";
import { Pagination } from "@/components/admin/Pagination";
import { Button, Input, Num, PageHeader, Select } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, day, money } from "@/server/format";
import { listOrders } from "@/server/services/orders";

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "order.view");
  if (!auth) return <Forbidden />;
  const parsed = orderListQuerySchema.safeParse(await searchParams);
  const f = parsed.success ? parsed.data : { page: 1 };
  const [t, tc, tAll, data] = await Promise.all([
    getTranslations("admin.orders"),
    getTranslations("common"),
    getTranslations(),
    listOrders({ ...f, from: f.from ? startOfBusinessDay(f.from) : undefined, to: f.to ? new Date(startOfBusinessDay(f.to).getTime() + 86_400_000) : undefined }),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={<Num>{data.total}</Num>} />
      <form method="get" className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={f.q} placeholder={t("searchPlaceholder")} className="max-w-xs" />
        <Select name="status" defaultValue={f.status ?? ""} className="w-auto">
          <option value="">{tc("status")}: {tc("all")}</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{tAll(`orderStatus.${s}`)}</option>)}
        </Select>
        <Select name="channel" defaultValue={f.channel ?? ""} className="w-auto">
          <option value="">{t("channel")}: {tc("all")}</option>
          <option value="B2C">{tAll("channel.B2C")}</option>
          <option value="B2B">{tAll("channel.B2B")}</option>
        </Select>
        <Input name="from" type="date" dir="ltr" defaultValue={f.from} className="num w-auto" aria-label={t("from")} />
        <Input name="to" type="date" dir="ltr" defaultValue={f.to} className="num w-auto" aria-label={t("to")} />
        <Button type="submit" variant="secondary">{tc("filter")}</Button>
      </form>
      <OrderSelection
        rows={data.items.map((o) => ({
          id: o.id,
          number: o.number,
          customer: o.customer.displayName,
          channel: tAll(`channel.${o.channel}`),
          status: o.status,
          statusLabel: tAll(`orderStatus.${o.status}`),
          zone: locale === "ar" ? o.zone.nameAr : o.zone.nameEn,
          placedAt: dateTimeText(o.placedAt),
          deliveryDay: day(o.requestedDeliveryDate),
          total: money(o.totalGross),
          payment: tAll(`paymentMethod.${o.paymentMethod}`),
        }))}
      />
      <Pagination page={f.page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
