import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { Badge, EmptyState, Num, PageHeader, Select, Button, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { listQuotes } from "@/server/services/quotes";

const QUOTE_STATUSES = ["REQUESTED", "DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"] as const;

export default async function QuotesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; page?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "quote.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const status = (QUOTE_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof QUOTE_STATUSES)[number]) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, tc, data] = await Promise.all([getTranslations("admin.quotes"), getTranslations("common"), listQuotes({ status, page })]);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} actions={auth.permissions.has("*") || auth.permissions.has("quote.edit") ? <Link href="/admin/quotes/new" className="rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white">{t("new")}</Link> : null} />
      <form method="get" className="flex gap-2">
        <Select name="status" defaultValue={status ?? ""} className="w-auto">
          <option value="">{tc("status")}: {tc("all")}</option>
          {QUOTE_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">{tc("filter")}</Button>
      </form>
      {data.items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{tc("number")}</Th>
              <Th>{t("customer")}</Th>
              <Th>{tc("status")}</Th>
              <Th>{t("validUntil")}</Th>
              <Th>{t("totalGross")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.items.map((q) => (
              <tr key={q.id} data-testid="quote-row">
                <Td><Link href={`/admin/quotes/${q.id}`} className="num font-medium text-brand-700 hover:underline">{q.number}</Link></Td>
                <Td>{q.customer.displayName}</Td>
                <Td><Badge tone={q.status === "REQUESTED" ? "amber" : q.status === "ACCEPTED" ? "green" : "neutral"}>{t(`status.${q.status}`)}</Badge></Td>
                <Td><Num>{day(q.validUntil)}</Num></Td>
                <Td className="num">{money(q.totalGross)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
