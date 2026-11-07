import { businessDate, hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Icon, type IconName } from "@/components/admin/Icon";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { PushToggle } from "@/components/notifications/PushToggle";
import { ORDER_STATUS_TONE } from "@/components/admin/status";
import { Badge, Card, Num, cn } from "@/components/ui";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaffPage, staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, money } from "@/server/format";
import { courierMoney, getDashboard, salesOverview } from "@/server/services/dashboard";
import { ownDriversEnabled } from "@/server/services/delivery-mode";

const PIPELINE = ["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY"] as const;

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "dashboard.view");
  if (!auth) {
    // Fahrer landen nach dem Login direkt in ihrer mobilen Ansicht
    const ctx = await requireStaffPage(locale);
    if (hasPermission(ctx.permissions, "delivery.driver")) redirect({ href: "/driver", locale });
    return <Forbidden />;
  }
  const [t, tAll, d, ownDrivers, sales, courier] = await Promise.all([getTranslations("admin.dashboard"), getTranslations(), getDashboard(), ownDriversEnabled(), salesOverview(), courierMoney()]);
  const showMargin = hasPermission(auth.permissions, "dashboard.view_margin");
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(auth.permissions, p);

  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hebron", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const name = auth.user.name.split(" ")[0] ?? "";
  const greeting = t(hour < 12 ? "greetMorning" : hour < 18 ? "greetDay" : "greetEvening", { name });
  const dateLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-PS-u-nu-latn" : "en-GB", { timeZone: "Asia/Hebron", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const change = d.revenueYesterday > 0 ? Math.round(((d.revenueToday - d.revenueYesterday) / d.revenueYesterday) * 100) : null;
  const month = d.revenue.month;
  const monthNet = month.B2C.net + month.B2B.net;
  const monthMargin = month.B2C.margin + month.B2B.margin;

  const kpis: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: IconName; href: string; accent: string; testId?: string }[] = [
    {
      label: t("kpiRevenueToday"),
      value: money(d.revenueToday),
      sub: change == null ? t("vsYesterdayNone") : (
        <span className={change >= 0 ? "text-green-700" : "text-red-700"}>
          <span className="num">{change >= 0 ? "▲" : "▼"} {Math.abs(change)}%</span> {t("vsYesterday")}
        </span>
      ),
      icon: "money",
      href: "/admin/reports",
      accent: "bg-sky-50 text-sky-700",
    },
    { label: t("kpiOrdersToday"), value: <Num>{d.ordersToday}</Num>, sub: t("kpiOrdersTodaySub"), icon: "cart", href: "/admin/orders", accent: "bg-brand-50 text-brand-700" },
    { label: t("kpiToProcess"), value: <Num>{d.toConfirm + d.inProgress}</Num>, sub: t("kpiToProcessSub", { n: d.toConfirm }), icon: "orders", href: "/admin/orders?status=NEW", accent: "bg-amber-50 text-amber-700" },
    { label: t("kpiOverdue"), value: money(d.overdue), sub: t("kpiOverdueSub", { n: d.overdueCount }), icon: "clock", href: "/admin/finance", accent: d.overdue > 0 ? "bg-red-50 text-red-700" : "bg-ink-100 text-ink-600" },
  ];

  const attention = [
    { n: d.toConfirm, label: t("attnConfirm"), href: "/admin/orders?status=NEW", icon: "cart" as const, show: can("order.view") },
    { n: d.pendingDealers, label: t("attnDealers"), href: "/admin/customers?status=PENDING_APPROVAL", icon: "users" as const, show: true, testId: "tile-pending" },
    { n: d.lowStock, label: t("attnLowStock"), href: "/admin/stock", icon: "box" as const, show: true },
    { n: d.overdueCount, label: t("attnOverdue"), href: "/admin/finance", icon: "file" as const, show: true },
    { n: d.outForDelivery, label: t("attnOnTheWay"), href: ownDrivers ? "/admin/delivery" : "/admin/orders?status=OUT_FOR_DELIVERY", icon: "truck" as const, show: true },
    { n: d.unsettledClosings, label: t("attnClosings"), href: "/admin/delivery", icon: "cash" as const, show: ownDrivers },
  ].filter((a) => a.show);
  const allClear = attention.every((a) => a.n === 0);

  const quick: { label: string; href: string; icon: IconName }[] = [
    { label: t("quickOrders"), href: "/admin/orders", icon: "orders" },
    { label: t("quickQuote"), href: "/admin/quotes", icon: "file" },
    { label: t("quickProduct"), href: "/admin/products", icon: "plus" },
    { label: t("quickPrices"), href: "/admin/prices", icon: "tag" },
  ];

  return (
    <div className="space-y-6">
      <PushToggle hideWhenOn />
      {/* Kopf */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-500">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-bold text-ink-900">{greeting}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <Link key={q.href} href={q.href} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50 hover:text-ink-900">
              <Icon name={q.icon} className="size-4 text-ink-500" />
              {q.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Verkauf & Lieferung getrennt + was die Zustellfirmen uns geben müssen */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={`🧾 ${t("sales.title")}`} className="xl:col-span-2">
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[22rem] text-sm" data-testid="sales-split">
              <thead className="text-xs text-ink-500">
                <tr>
                  <th className="py-2 text-start font-medium" />
                  <th className="py-2 text-end font-medium">{t("sales.goods")}</th>
                  <th className="py-2 text-end font-medium">{t("sales.delivery")}</th>
                  <th className="py-2 text-end font-medium">{t("sales.total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {(["today", "week", "month"] as const).map((k) => (
                  <tr key={k}>
                    <td className="py-2.5">
                      <p className="font-medium text-ink-900">{t(`period.${k}`)}</p>
                      <p className="text-xs text-ink-500">{t("ordersCount", { count: sales[k].orders })}</p>
                    </td>
                    {/* Zelle bündig mit der Überschrift; nur die Zahl selbst ist LTR */}
                    <td className="py-2.5 text-end"><span className="num font-semibold text-ink-900">{money(sales[k].goods)}</span></td>
                    <td className="py-2.5 text-end"><span className="num text-sky-800">{money(sales[k].delivery)}</span></td>
                    <td className="py-2.5 text-end"><span className="num font-bold text-ink-900">{money(sales[k].total)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-500">{t("sales.note")}</p>
        </Card>

        <Link href="/admin/finance/couriers" className={cn("block rounded-2xl p-5 shadow-sm ring-1 transition hover:shadow-md", courier.owed > 0 ? "bg-amber-50 ring-amber-200" : "bg-white ring-ink-200")} data-testid="courier-card">
          <p className="text-sm font-medium text-ink-700">🚚 {t("sales.courierTitle")}</p>
          <p className="num mt-2 text-3xl font-bold text-ink-900" data-testid="courier-owed-total">{money(courier.owed)}</p>
          <p className="text-xs text-ink-600">{t("sales.courierOwed")}</p>
          <p className="mt-3 text-sm text-ink-700">{t("sales.courierWay")}: <span className="num font-semibold">{money(courier.onTheWay)}</span></p>
          {courier.companies.length ? (
            <ul className="mt-3 space-y-1 border-t border-ink-200/70 pt-3 text-sm">
              {courier.companies.slice(0, 4).map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="truncate text-ink-700">{c.name}</span>
                  <span className="num shrink-0 font-semibold text-ink-900">{money(c.owed)}{c.onTheWay ? <span className="text-xs font-normal text-ink-500"> + {money(c.onTheWay)}</span> : null}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-green-700">✓ {t("sales.courierNone")}</p>
          )}
          <p className="mt-3 text-sm font-semibold text-brand-700">{t("sales.courierAction")} →</p>
        </Link>
      </div>

      {/* Kennzahlen */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} data-testid={k.testId} className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-200 transition hover:shadow-md hover:ring-ink-300">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-ink-600">{k.label}</p>
              <span className={cn("grid size-9 place-items-center rounded-xl", k.accent)}><Icon name={k.icon} /></span>
            </div>
            <p className="num mt-3 text-2xl font-bold text-ink-900">{k.value}</p>
            {k.sub ? <p className="mt-1 text-xs text-ink-500">{k.sub}</p> : null}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Umsatzverlauf */}
        <Card title={t("chartTitle")} className="xl:col-span-2" actions={<span className="text-xs text-ink-500">{t("chartNote")}</span>}>
          <RevenueChart
            data={d.series}
            labels={{ b2c: tAll("channel.B2C"), b2b: tAll("channel.B2B"), total: t("total"), table: t("showTable"), day: t("day") }}
          />
          <div className="mt-4 grid gap-3 border-t border-ink-100 pt-4 sm:grid-cols-3" data-testid="revenue-B2C">
            <div>
              <p className="text-xs text-ink-500">{t("period.week")}</p>
              <p className="num font-semibold">{money(d.revenue.week.B2C.net + d.revenue.week.B2B.net)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">{t("period.month")}</p>
              <p className="num font-semibold">{money(monthNet)}</p>
              <p className="num text-xs text-ink-500">{tAll("channel.B2C")} {money(month.B2C.net)} · {tAll("channel.B2B")} {money(month.B2B.net)}</p>
            </div>
            {showMargin ? (
              <div>
                <p className="text-xs text-ink-500">{t("marginMonth")}</p>
                <p className="num font-semibold">{money(monthMargin)}</p>
                <p className="num text-xs text-ink-500">{monthNet > 0 ? `${Math.round((monthMargin / monthNet) * 100)}%` : "–"}</p>
              </div>
            ) : null}
          </div>
        </Card>

        {/* Handlungsbedarf */}
        <Card title={t("attention")}>
          {allClear ? (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 p-4 text-green-800">
              <Icon name="check" />
              <p className="text-sm font-medium">{t("allClear")}</p>
            </div>
          ) : null}
          <ul className="divide-y divide-ink-100">
            {attention.map((a) => (
              <li key={a.label}>
                <Link href={a.href} data-testid={a.testId} className="flex items-center gap-3 py-2.5 hover:text-ink-900">
                  <span className={cn("grid size-8 place-items-center rounded-lg", a.n > 0 ? "bg-amber-50 text-amber-700" : "bg-ink-50 text-ink-400")}>
                    <Icon name={a.icon} className="size-4" />
                  </span>
                  <span className={cn("flex-1 text-sm", a.n > 0 ? "text-ink-800" : "text-ink-500")}>{a.label}</span>
                  <span className={cn("num min-w-8 rounded-full px-2 py-0.5 text-center text-sm font-semibold", a.n > 0 ? "bg-amber-100 text-amber-900" : "text-ink-400")}>{a.n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Bestell-Pipeline */}
      <Card title={t("pipeline")} actions={<Link href="/admin/orders" className="text-sm text-brand-700 hover:underline">{t("openOrdersLink")}</Link>}>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PIPELINE.map((s, i) => {
            const n = d.ordersByStatus[s] ?? 0;
            return (
              <li key={s} className="relative">
                <Link href={`/admin/orders?status=${s}`} className={cn("block rounded-xl p-3 ring-1 transition hover:ring-ink-300", n > 0 ? "bg-white ring-ink-200" : "bg-ink-50 ring-transparent")}>
                  <p className="flex items-center gap-1.5 text-xs text-ink-500">
                    <span className="num grid size-5 place-items-center rounded-full bg-ink-100 text-[10px] font-semibold text-ink-600">{i + 1}</span>
                    {tAll(`orderStatus.${s}`)}
                  </p>
                  <p className={cn("num mt-1 text-2xl font-bold", n > 0 ? "text-ink-900" : "text-ink-300")}>{n}</p>
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Neueste Bestellungen */}
        <Card title={t("latest")} actions={<Link href="/admin/orders" className="text-sm text-brand-700 hover:underline">{t("all")}</Link>}>
          {d.latest.length === 0 ? <p className="text-sm text-ink-500">{t("noOrders")}</p> : null}
          <ul className="divide-y divide-ink-100">
            {d.latest.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 py-2.5 hover:bg-ink-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{o.customer.displayName}</p>
                    <p className="num text-xs text-ink-500">{o.number} · {dateTimeText(o.placedAt).slice(businessDate(o.placedAt) === businessDate(new Date()) ? 11 : 0)} · {tAll(`channel.${o.channel}`)}</p>
                  </div>
                  <Badge tone={ORDER_STATUS_TONE[o.status]}>{tAll(`orderStatus.${o.status}`)}</Badge>
                  <span className="num w-24 text-end text-sm font-semibold">{money(o.totalGross)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {/* Top-Produkte */}
        <Card title={t("topProducts")}>
          {d.top.length === 0 ? <p className="text-sm text-ink-500">{t("noSales")}</p> : null}
          <ol className="space-y-3">
            {d.top.map((p, i) => {
              const max = d.top[0]?.net || 1;
              return (
                <li key={p.sku} className="flex items-center gap-3">
                  <span className="num grid size-6 place-items-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-ink-900">{locale === "ar" ? p.nameAr : p.nameEn}</p>
                      <p className="num shrink-0 text-sm font-semibold">{money(p.net)}</p>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-ink-100">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.max(4, (p.net / max) * 100)}%`, background: "#2a78d6" }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      {/* Basiszahlen */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("customersB2C"), value: d.customers.B2C ?? 0, href: "/admin/customers?type=B2C" },
          { label: t("customersB2B"), value: d.customers.B2B ?? 0, href: "/admin/customers?type=B2B" },
          { label: t("receivables"), value: money(d.receivables), href: "/admin/finance" },
          ownDrivers
            ? { label: t("driverCash"), value: money(d.driverCash), href: "/admin/delivery" }
            : { label: t("withCourier"), value: d.outForDelivery, href: "/admin/orders?status=OUT_FOR_DELIVERY" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-ink-200 hover:ring-ink-300">
            <span className="text-sm text-ink-600">{s.label}</span>
            <span className="num font-semibold text-ink-900">{s.value}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
