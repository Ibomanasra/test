import { AGING_BUCKETS, hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiForm } from "@/components/admin/ApiForm";
import { Forbidden } from "@/components/admin/Forbidden";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Card, EmptyState, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { money } from "@/server/format";
import { openItems } from "@/server/services/finance";

export default async function OpenItemsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "finance.view");
  if (!auth) return <Forbidden />;
  const [t, data] = await Promise.all([getTranslations("admin.finance"), openItems()]);
  const rows = data.customers.map((c) => ({ customer: c.customer.displayName, ...Object.fromEntries(AGING_BUCKETS.map((b) => [b, money(c.summary[b])])), total: money(c.summary.total), oldest: c.oldestDays }));
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[...AGING_BUCKETS, "total" as const].map((b) => (
          <Card key={b}><p className="text-xs text-ink-500">{t(`aging.${b}`)}</p><p className={`num text-lg font-semibold ${b === "d90_plus" && data.summary[b] ? "text-red-700" : ""}`} data-testid={`aging-${b}`}>{money(data.summary[b])}</p></Card>
        ))}
      </div>
      <div className="flex justify-end">
        <PrintTableButton data={{ title: t("tabs.openItems"), landscape: true, columns: [{ key: "customer", label: t("customer") }, ...AGING_BUCKETS.map((b) => ({ key: b, label: t(`aging.${b}`), kind: "num" as const })), { key: "total", label: t("aging.total"), kind: "num" }, { key: "oldest", label: t("oldestDays"), kind: "num" }], rows }} />
      </div>
      {data.customers.length === 0 ? (
        <EmptyState>{t("noOpenItems")}</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>{t("customer")}</Th>{AGING_BUCKETS.map((b) => <Th key={b}>{t(`aging.${b}`)}</Th>)}<Th>{t("aging.total")}</Th><Th>{t("oldestDays")}</Th><Th /></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {data.customers.map((c) => (
              <tr key={c.customer.id} data-testid="open-item-row">
                <Td><Link href={`/admin/customers/${c.customer.id}`} className="text-brand-700 hover:underline">{c.customer.displayName}</Link> <span className="num text-xs text-ink-500">{c.customer.number}</span></Td>
                {AGING_BUCKETS.map((b) => <Td key={b} className={`num ${c.summary[b] && b !== "current" ? "text-red-700" : ""}`}>{c.summary[b] ? money(c.summary[b]) : "–"}</Td>)}
                <Td className="num font-semibold">{money(c.summary.total)}</Td>
                <Td className="num">{c.oldestDays}</Td>
                <Td><PrintButton href={`/api/v1/documents/statement/${c.customer.id}`} label={t("statement")} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {hasPermission(auth.permissions, "finance.dunning") ? (
        <Card title={t("runDunning")}>
          <p className="mb-3 text-sm text-ink-600">{t("dunningHint")}</p>
          <ApiForm endpoint="/api/v1/admin/dunning" testId="dunning" submitLabel={t("runDunningSubmit")} successText={t("dunningDone")} redirect={undefined} fields={[{ name: "feeAgorot", label: t("dunningFee"), type: "money", hint: t("dunningFeeHint") }]} defaults={{ feeAgorot: "0" }} />
        </Card>
      ) : null}
    </div>
  );
}
