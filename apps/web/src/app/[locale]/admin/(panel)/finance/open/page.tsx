import { AGING_BUCKETS, hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Icon } from "@/components/admin/Icon";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { EmptyState, cn } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { money } from "@/server/format";
import { openItems } from "@/server/services/finance";

/** Altersstufen als Farben: noch nicht fällig → grün, dann immer röter */
const BUCKET_COLOR = { current: "#16a34a", d1_30: "#f59e0b", d31_60: "#f97316", d61_90: "#dc2626", d90_plus: "#7f1d1d" } as const;

export default async function WhoOwesUsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "finance.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const [t, data] = await Promise.all([getTranslations("admin.finance"), openItems()]);
  const canPay = hasPermission(auth.permissions, "finance.payment");
  const onlyOverdue = sp.view === "overdue";
  const list = onlyOverdue ? data.customers.filter((c) => c.summary.total - c.summary.current > 0) : data.customers;
  const overdueTotal = data.summary.total - data.summary.current;
  const rows = list.map((c) => ({ customer: c.customer.displayName, ...Object.fromEntries(AGING_BUCKETS.map((b) => [b, money(c.summary[b])])), total: money(c.summary.total), oldest: c.oldestDays }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-200">
          <p className="text-sm text-ink-600">{t("simple.owedToUs")}</p>
          <p className="num mt-1 text-2xl font-bold" data-testid="aging-total">{money(data.summary.total)}</p>
          <p className="text-xs text-ink-500">{t("simple.customersCount", { count: data.customers.length })}</p>
        </div>
        <div className={cn("rounded-2xl p-4 ring-1", overdueTotal > 0 ? "bg-red-50 ring-red-200" : "bg-white ring-ink-200")}>
          <p className="text-sm text-ink-600">{t("simple.overdue")}</p>
          <p className={cn("num mt-1 text-2xl font-bold", overdueTotal > 0 && "text-red-700")}>{money(overdueTotal)}</p>
          <p className="text-xs text-ink-500">{t("simple.overdueHint")}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-200">
          <p className="text-sm text-ink-600">{t("simple.notDue")}</p>
          <p className="num mt-1 text-2xl font-bold text-green-700">{money(data.summary.current)}</p>
          <p className="text-xs text-ink-500">{t("simple.notDueHint")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {[["", t("simple.all")], ["overdue", t("simple.onlyOverdue")]].map(([v, label]) => (
          <Link key={v} href={v ? `/admin/finance/open?view=${v}` : "/admin/finance/open"} className={cn("rounded-full px-3 py-1 ring-1", (sp.view ?? "") === v ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:bg-ink-50")}>
            {label}
          </Link>
        ))}
        {/* Legende der Farbbalken */}
        <span className="ms-auto hidden flex-wrap items-center gap-3 text-xs text-ink-500 md:flex">
          {AGING_BUCKETS.map((b) => (
            <span key={b} className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: BUCKET_COLOR[b] }} />{t(`aging.${b}`)}</span>
          ))}
        </span>
        <PrintTableButton data={{ title: t("tabs.openItems"), landscape: true, columns: [{ key: "customer", label: t("customer") }, ...AGING_BUCKETS.map((b) => ({ key: b, label: t(`aging.${b}`), kind: "num" as const })), { key: "total", label: t("aging.total"), kind: "num" }, { key: "oldest", label: t("oldestDays"), kind: "num" }], rows }} />
      </div>

      {list.length === 0 ? (
        <EmptyState>{t("noOpenItems")}</EmptyState>
      ) : (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-ink-200">
          {list.map((c) => {
            const overdue = c.summary.total - c.summary.current;
            return (
              <li key={c.customer.id} data-testid="open-item-row" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-48 flex-1">
                  <Link href={`/admin/customers/${c.customer.id}`} className="font-medium text-ink-900 hover:text-brand-700 hover:underline">{c.customer.displayName}</Link>
                  <span className="num ms-2 text-xs text-ink-400">{c.customer.number}</span>
                  {/* Altersstruktur als ein Balken */}
                  <div className="mt-1.5 flex h-1.5 w-full max-w-xs gap-0.5 overflow-hidden rounded-full bg-ink-100" title={AGING_BUCKETS.map((b) => `${t(`aging.${b}`)}: ${money(c.summary[b])}`).join(" · ")}>
                    {AGING_BUCKETS.filter((b) => c.summary[b] > 0).map((b) => (
                      <span key={b} style={{ width: `${(c.summary[b] / c.summary.total) * 100}%`, background: BUCKET_COLOR[b] }} />
                    ))}
                  </div>
                </div>
                <div className="w-32 text-end">
                  <p className="num font-semibold text-ink-900">{money(c.summary.total)}</p>
                  {overdue > 0 ? (
                    <p className="num text-xs font-medium text-red-700">{t("simple.overdueSince", { amount: money(overdue), days: c.oldestDays })}</p>
                  ) : (
                    <p className="text-xs text-green-700">{t("simple.allOnTime")}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canPay ? (
                    <Link href={`/admin/finance/payments?customer=${c.customer.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800" data-testid="pay-link">
                      <Icon name="cash" className="size-4" /> {t("simple.recordPayment")}
                    </Link>
                  ) : null}
                  <PrintButton href={`/api/v1/documents/statement/${c.customer.id}`} label={t("statement")} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
