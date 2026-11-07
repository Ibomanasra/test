import { orderListQuerySchema } from "@sa/contracts";
import { ORDER_STATUSES, businessDate, hasPermission, startOfBusinessDay, type OrderStatusKey } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Icon } from "@/components/admin/Icon";
import { OrderBoard } from "@/components/admin/OrderBoard";
import { Pagination } from "@/components/admin/Pagination";
import { Button, Input, Num, Select, cn } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, day, money } from "@/server/format";
import { listDeliveryCompanies } from "@/server/services/delivery-companies";
import { listOrders, orderStatusCounts } from "@/server/services/orders";

const OPEN: OrderStatusKey[] = ["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY"];
/** Reiter in Arbeitsschritten: „Vorbereiten“ zeigt auch alte „In Kommissionierung“-Bestellungen */
const STEP_TABS: { key: OrderStatusKey; statuses: OrderStatusKey[] }[] = [
  { key: "NEW", statuses: ["NEW"] },
  { key: "CONFIRMED", statuses: ["CONFIRMED", "PICKING"] },
  { key: "READY", statuses: ["READY"] },
  { key: "OUT_FOR_DELIVERY", statuses: ["OUT_FOR_DELIVERY"] },
];

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "order.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  // Reiter: „open“ (Standard), „all“ oder ein einzelner Status
  const view = sp.status === "all" ? "all" : sp.status && (ORDER_STATUSES as readonly string[]).includes(sp.status) ? sp.status : "open";
  const parsed = orderListQuerySchema.safeParse({ ...sp, status: undefined });
  const f = parsed.success ? parsed.data : { page: 1 };
  const todayYmd = businessDate(new Date());
  const tomorrowYmd = businessDate(new Date(startOfBusinessDay(todayYmd).getTime() + 36 * 3_600_000));
  const deliv = sp.deliv === "today" ? todayYmd : sp.deliv === "tomorrow" ? tomorrowYmd : undefined;
  const base = {
    q: f.q,
    channel: f.channel,
    deliveryDate: deliv ? new Date(`${deliv}T00:00:00Z`) : undefined,
    from: f.from ? startOfBusinessDay(f.from) : undefined,
    to: f.to ? new Date(startOfBusinessDay(f.to).getTime() + 86_400_000) : undefined,
  };
  const stepTab = STEP_TABS.find((x) => x.key === view);
  const [t, tc, tAll, data, counts, companies] = await Promise.all([
    getTranslations("admin.orders"),
    getTranslations("common"),
    getTranslations(),
    listOrders({
      ...base,
      page: f.page,
      statuses: view === "open" ? OPEN : stepTab?.statuses,
      status: view !== "open" && view !== "all" && !stepTab ? (view as OrderStatusKey) : undefined,
    }),
    orderStatusCounts(base),
    listDeliveryCompanies(true),
  ]);

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | undefined> = { status: view === "open" ? undefined : view, q: f.q, channel: f.channel, deliv: sp.deliv, from: f.from, to: f.to };
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };
  const n = (s: OrderStatusKey) => counts[s] ?? 0;
  const tabs: { key: string; label: string; count: number }[] = [
    { key: "open", label: t("board.tabOpen"), count: OPEN.reduce((a, s) => a + n(s), 0) },
    ...STEP_TABS.map((x) => ({ key: x.key, label: t(`board.tab.${x.key}`), count: x.statuses.reduce((a, s) => a + n(s), 0) })),
    { key: "DELIVERED", label: tAll("orderStatus.DELIVERED"), count: n("DELIVERED") },
    { key: "CANCELLED", label: tAll("orderStatus.CANCELLED"), count: n("CANCELLED") },
    { key: "all", label: tc("all"), count: ORDER_STATUSES.reduce((a, s) => a + n(s), 0) },
  ];
  const moreFilters = Boolean(f.from || f.to || f.channel);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{t("title")}</h1>
          <p className="text-sm text-ink-500"><Num>{data.total}</Num> {t("board.results")}</p>
        </div>
        <form method="get" className="flex w-full max-w-md gap-2 sm:w-auto">
          {view !== "open" ? <input type="hidden" name="status" value={view} /> : null}
          {sp.deliv ? <input type="hidden" name="deliv" value={sp.deliv} /> : null}
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <Input name="q" defaultValue={f.q} placeholder={t("searchPlaceholder")} className="ps-9" />
          </div>
          <Button type="submit" variant="secondary">{tc("search")}</Button>
        </form>
      </div>

      {/* Status-Reiter */}
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label={tc("status")}>
        {tabs.map((tab) => {
          const active = tab.key === view;
          return (
            <Link
              key={tab.key}
              href={href({ status: tab.key === "open" ? undefined : tab.key, page: undefined })}
              aria-current={active ? "page" : undefined}
              data-testid={`tab-${tab.key}`}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                active ? "bg-ink-900 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50",
              )}
            >
              {tab.label}
              <span className={cn("num rounded-full px-1.5 text-xs", active ? "bg-white/20" : tab.key === "NEW" && tab.count > 0 ? "bg-amber-100 text-amber-900" : "bg-ink-100 text-ink-600")}>{tab.count}</span>
            </Link>
          );
        })}
      </nav>

      {/* Schnellfilter */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-500">{t("board.deliveryFilter")}</span>
        {([undefined, "today", "tomorrow"] as const).map((d) => (
          <Link
            key={d ?? "any"}
            href={href({ deliv: d, page: undefined })}
            className={cn("rounded-lg px-2.5 py-1 ring-1", sp.deliv === d || (!sp.deliv && !d) ? "bg-brand-50 font-medium text-brand-800 ring-brand-200" : "bg-white text-ink-600 ring-ink-200 hover:bg-ink-50")}
          >
            {d ? t(`board.when.${d}`) : tc("all")}
          </Link>
        ))}
        <details className="group ms-auto" open={moreFilters}>
          <summary className="cursor-pointer list-none rounded-lg px-2.5 py-1 text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50">{t("board.moreFilters")}</summary>
          <form method="get" className="mt-2 hidden flex-wrap gap-2 group-open:flex">
            {view !== "open" ? <input type="hidden" name="status" value={view} /> : null}
            {f.q ? <input type="hidden" name="q" value={f.q} /> : null}
            <Select name="channel" defaultValue={f.channel ?? ""} className="w-auto">
              <option value="">{t("channel")}: {tc("all")}</option>
              <option value="B2C">{tAll("channel.B2C")}</option>
              <option value="B2B">{tAll("channel.B2B")}</option>
            </Select>
            <Input name="from" type="date" dir="ltr" defaultValue={f.from} className="num w-auto" aria-label={t("from")} />
            <Input name="to" type="date" dir="ltr" defaultValue={f.to} className="num w-auto" aria-label={t("to")} />
            <Button type="submit" variant="secondary">{tc("filter")}</Button>
          </form>
        </details>
      </div>

      <OrderBoard
        canConfirm={hasPermission(auth.permissions, "order.confirm")}
        canStatus={hasPermission(auth.permissions, "order.status")}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        rows={data.items.map((o) => {
          const snap = (o.addressSnapshot ?? {}) as { city?: string };
          const dd = day(o.requestedDeliveryDate);
          const open = OPEN.includes(o.status);
          const hint = !dd || !open ? "" : dd < todayYmd && o.status !== "OUT_FOR_DELIVERY" ? "late" : dd === todayYmd ? "today" : dd === tomorrowYmd ? "tomorrow" : "";
          return {
            id: o.id,
            number: o.number,
            customer: o.customer.displayName,
            customerNo: o.customer.number,
            channel: o.channel,
            channelLabel: tAll(`channel.${o.channel}`),
            status: o.status,
            statusLabel: tAll(`orderStatus.${o.status}`),
            zone: locale === "ar" ? o.zone.nameAr : o.zone.nameEn,
            city: snap.city ?? "",
            placedAt: dateTimeText(o.placedAt),
            deliveryDay: dd,
            deliveryHint: hint,
            items: o._count.items,
            total: money(o.totalGross),
            goods: money(o.totalGross - o.deliveryFeeGross),
            delivery: o.deliveryFeeGross > 0 ? money(o.deliveryFeeGross) : "",
            payment: tAll(`paymentMethod.${o.paymentMethod}`),
            paid: o.paymentStatus === "PAID",
            company: o.shipments[0]?.deliveryCompany?.name,
          };
        })}
      />
      <Pagination page={f.page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
