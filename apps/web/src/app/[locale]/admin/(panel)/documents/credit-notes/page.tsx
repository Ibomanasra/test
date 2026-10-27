import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Badge, Button, EmptyState, Input, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { listCreditNotes } from "@/server/services/invoicing";

export default async function CreditNotesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "finance.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, tc, data] = await Promise.all([getTranslations("admin.documents"), getTranslations("common"), listCreditNotes({ q: sp.q, page })]);
  const rows = data.items.map((c) => ({ number: c.number, date: day(c.issueDate), invoice: c.invoice.number, customer: c.customer.displayName, reason: c.reason, total: money(c.totalGross) }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex gap-2">
          <Input name="q" defaultValue={sp.q} placeholder={t("searchPlaceholder")} className="max-w-xs" />
          <Button type="submit" variant="secondary">{tc("filter")}</Button>
        </form>
        <span className="ms-auto">
          <PrintTableButton
            data={{
              title: t("tabs.creditNotes"),
              columns: [
                { key: "number", label: tc("number") },
                { key: "date", label: t("date"), kind: "num" },
                { key: "invoice", label: t("invoice") },
                { key: "customer", label: t("customer") },
                { key: "reason", label: t("reason") },
                { key: "total", label: t("total"), kind: "num" },
              ],
              rows,
            }}
          />
        </span>
      </div>
      {data.items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{tc("number")}</Th>
              <Th>{t("date")}</Th>
              <Th>{t("invoice")}</Th>
              <Th>{t("customer")}</Th>
              <Th>{t("reason")}</Th>
              <Th>{t("total")}</Th>
              <Th>{t("archive")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.items.map((c, idx) => (
              <tr key={c.id} data-testid="credit-note-row">
                <Td className="num font-medium">{c.number}</Td>
                <Td className="num">{rows[idx]!.date}</Td>
                <Td><Link href={`/admin/documents/invoices/${c.invoice.id}`} className="num text-brand-700 hover:underline">{c.invoice.number}</Link></Td>
                <Td>{c.customer.displayName}</Td>
                <Td className="text-sm">{c.reason}</Td>
                <Td className="num">{rows[idx]!.total}</Td>
                <Td>{c.archivedDocId ? <Badge tone="green">{t("frozen")}</Badge> : <Badge tone="amber">{t("pendingArchive")}</Badge>}</Td>
                <Td><PrintButton href={`/api/v1/documents/credit-note/${c.id}`} label="PDF" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
