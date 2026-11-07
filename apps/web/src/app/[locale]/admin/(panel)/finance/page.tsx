import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Icon, type IconName } from "@/components/admin/Icon";
import { Card, cn } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, money } from "@/server/format";
import { financeOverview } from "@/server/services/finance";

export default async function FinanceOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "finance.view");
  if (!auth) return <Forbidden />;
  const [t, tAll, d] = await Promise.all([getTranslations("admin.finance"), getTranslations(), financeOverview()]);
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(auth.permissions, p);

  const tiles: { label: string; value: string; sub: string; href: string; tone: string }[] = [
    { label: t("simple.owedToUs"), value: money(d.owedToUs), sub: t("simple.customersCount", { count: d.debtorCount }), href: "/admin/finance/open", tone: "bg-white ring-ink-200" },
    { label: t("simple.overdue"), value: money(d.overdue), sub: t("simple.overdueCustomers", { count: d.overdueCustomers }), href: "/admin/finance/open?view=overdue", tone: d.overdue > 0 ? "bg-red-50 ring-red-200" : "bg-white ring-ink-200" },
    { label: t("simple.paidToday"), value: money(d.paidToday), sub: t("simple.paymentsCount", { count: d.paidTodayCount }), href: "/admin/finance/payments", tone: "bg-green-50 ring-green-200" },
    { label: t("simple.paidMonth"), value: money(d.paidMonth), sub: t("simple.driverCash", { amount: money(d.driverCash) }), href: "/admin/finance/payments", tone: "bg-white ring-ink-200" },
  ];

  const actions: { href: string; icon: IconName; title: string; text: string; show: boolean; primary?: boolean; testId?: string }[] = [
    { href: "/admin/finance/payments?new=1", icon: "cash", title: t("simple.actPay"), text: t("simple.actPayText"), show: can("finance.payment"), primary: true, testId: "act-pay" },
    { href: "/admin/finance/open", icon: "users", title: t("simple.actDebtors"), text: t("simple.actDebtorsText"), show: true },
    { href: "/admin/finance/returns", icon: "arrow", title: t("simple.actReturn"), text: t("simple.actReturnText"), show: can("finance.credit_note") },
    { href: "/admin/finance/exports", icon: "file", title: t("simple.actExport"), text: t("simple.actExportText"), show: can("finance.export") },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((k) => (
          <Link key={k.label} href={k.href} className={cn("rounded-2xl p-5 shadow-sm ring-1 transition hover:shadow-md", k.tone)}>
            <p className="text-sm font-medium text-ink-600">{k.label}</p>
            <p className="num mt-2 text-2xl font-bold text-ink-900">{k.value}</p>
            <p className="mt-1 text-xs text-ink-500">{k.sub}</p>
          </Link>
        ))}
      </div>

      {/* Was möchtest du tun? */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-ink-900">{t("simple.whatToDo")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.filter((a) => a.show).map((a) => (
            <Link
              key={a.href}
              href={a.href}
              data-testid={a.testId}
              className={cn("group flex items-start gap-3 rounded-2xl p-4 ring-1 transition hover:shadow-md", a.primary ? "bg-brand-700 text-white ring-brand-700 hover:bg-brand-800" : "bg-white ring-ink-200 hover:ring-ink-300")}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", a.primary ? "bg-white/15" : "bg-ink-50 text-ink-600")}><Icon name={a.icon} /></span>
              <span>
                <span className="block font-semibold">{a.title}</span>
                <span className={cn("block text-sm", a.primary ? "text-white/80" : "text-ink-500")}>{a.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("simple.topDebtors")} actions={<Link href="/admin/finance/open" className="text-sm text-brand-700 hover:underline">{t("simple.showAll")}</Link>}>
          {d.topDebtors.length === 0 ? <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{t("simple.nobodyOwes")}</p> : null}
          <ul className="divide-y divide-ink-100">
            {d.topDebtors.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/customers/${c.id}`} className="truncate text-sm font-medium text-ink-900 hover:underline">{c.name}</Link>
                  {c.overdue > 0 ? <p className="num text-xs text-red-700">{t("simple.overdueSince", { amount: money(c.overdue), days: c.oldestDays })}</p> : <p className="text-xs text-green-700">{t("simple.allOnTime")}</p>}
                </div>
                <span className="num text-sm font-semibold">{money(c.open)}</span>
                {can("finance.payment") ? (
                  <Link href={`/admin/finance/payments?customer=${c.id}`} className="rounded-lg px-2.5 py-1 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">{t("simple.pay")}</Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t("simple.latestPayments")} actions={<Link href="/admin/finance/payments" className="text-sm text-brand-700 hover:underline">{t("simple.showAll")}</Link>}>
          {d.latest.length === 0 ? <p className="text-sm text-ink-500">{t("simple.noPayments")}</p> : null}
          <ul className="divide-y divide-ink-100">
            {d.latest.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-green-50 text-green-700"><Icon name="check" className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{p.customer.displayName}</p>
                  <p className="num text-xs text-ink-500">{dateTimeText(p.receivedAt)} · {tAll(`paymentMethod.${p.method}`)}</p>
                </div>
                <span className="num text-sm font-semibold text-green-700">+{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
