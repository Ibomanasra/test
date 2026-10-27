import { ORDER_STATUSES, hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Card, Num, PageHeader } from "@/components/ui";
import { money } from "@/server/format";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaffPage, staffPagePermission } from "@/server/auth/page-guards";
import { getDashboardBasics } from "@/server/services/dashboard";

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
  const [t, tAll, data] = await Promise.all([getTranslations("admin.dashboard"), getTranslations(), getDashboardBasics()]);
  const showMargin = hasPermission(auth.permissions, "dashboard.view_margin");

  const tiles = [
    { label: t("pendingDealers"), value: data.pendingDealers, href: "/admin/customers?status=PENDING_APPROVAL", highlight: data.pendingDealers > 0, testId: "tile-pending" },
    { label: t("customersB2C"), value: data.customers.B2C ?? 0, href: "/admin/customers?type=B2C" },
    { label: t("customersB2B"), value: data.customers.B2B ?? 0, href: "/admin/customers?type=B2B" },
    { label: t("staff"), value: data.staffCount, href: "/admin/users" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            data-testid={tile.testId}
            className={`rounded-xl p-5 shadow-sm ring-1 ${tile.highlight ? "bg-amber-50 ring-amber-300" : "bg-white ring-ink-200"} hover:ring-brand-400`}
          >
            <p className="text-sm text-ink-600">{tile.label}</p>
            <p className="mt-2 text-3xl font-bold"><Num>{tile.value}</Num></p>
          </Link>
        ))}
      </div>
      <Card title={t("openOrders")}>
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ORDER_STATUSES.filter((s) => s !== "DELIVERED" && s !== "CANCELLED").map((s) => (
            <li key={s}><Link href={`/admin/orders?status=${s}`} className="block rounded-lg bg-ink-50 p-3 hover:bg-ink-100">
              <p className="text-xs text-ink-500">{tAll(`orderStatus.${s}`)}</p>
              <p className="text-xl font-semibold"><Num>{data.ordersByStatus[s] ?? 0}</Num></p>
            </Link></li>
          ))}
        </ul>
      </Card>
      <Card title={t("revenue")}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-ink-500">
                <th className="py-2 text-start font-medium" />
                {(["today", "week", "month"] as const).map((p) => <th key={p} className="py-2 text-start font-medium">{t(`period.${p}`)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {(["B2C", "B2B"] as const).map((ch) => (
                <tr key={ch} data-testid={`revenue-${ch}`}>
                  <td className="py-2 font-medium">{tAll(`channel.${ch}`)}</td>
                  {(["today", "week", "month"] as const).map((p) => {
                    const r = data.revenue[p][ch];
                    return (
                      <td key={p} className="py-2">
                        <span className="num block font-semibold">{money(r.net)}</span>
                        <span className="num block text-xs text-ink-500">{t("ordersCount", { count: r.orders })}{showMargin ? ` · ${t("marginShort")} ${money(r.margin)}` : ""}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-500">{t("revenueNote")}</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/products" className={`rounded-xl p-5 shadow-sm ring-1 ${data.lowStock > 0 ? "bg-amber-50 ring-amber-300" : "bg-white ring-ink-200"}`}>
          <p className="text-sm text-ink-600">{t("lowStock")}</p>
          <p className="mt-2 text-3xl font-bold"><Num>{data.lowStock}</Num></p>
        </Link>
        <Link href="/admin/finance" className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-ink-200">
          <p className="text-sm text-ink-600">{t("receivables")}</p>
          <p className="mt-2 text-2xl font-bold">{money(data.receivables)}</p>
        </Link>
        <Link href="/admin/delivery" className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-ink-200">
          <p className="text-sm text-ink-600">{t("driverCash")}</p>
          <p className="mt-2 text-2xl font-bold">{money(data.driverCash)}</p>
        </Link>
      </div>
    </div>
  );
}
