import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Badge, Button, EmptyState, Input, Num, Select, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { listInvoices } from "@/server/services/invoicing";

const TONE = { ISSUED: "amber", PARTIALLY_PAID: "blue", PAID: "green", CREDITED: "neutral" } as const;

export default async function InvoicesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "finance.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, tc, tAll, data] = await Promise.all([getTranslations("admin.documents"), getTranslations("common"), getTranslations(), listInvoices({ q: sp.q, status: sp.status, page })]);
  const rows = data.items.map((i) => ({
    number: i.number,
    date: day(i.issueDate),
    due: day(i.dueDate),
    customer: i.customer.displayName,
    order: i.order?.number ?? "",
    status: t(`invoiceStatus.${i.status}`),
    total: money(i.totalGross),
    open: money(Math.max(0, i.totalGross - i.paidAmount - i.creditedAmount)),
  }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-wrap gap-2">
          <Input name="q" defaultValue={sp.q} placeholder={t("searchPlaceholder")} className="max-w-xs" />
          <Select name="status" defaultValue={sp.status ?? ""} className="w-auto">
            <option value="">{tc("status")}: {tc("all")}</option>
            {(["ISSUED", "PARTIALLY_PAID", "PAID", "CREDITED"] as const).map((s) => <option key={s} value={s}>{t(`invoiceStatus.${s}`)}</option>)}
          </Select>
          <Button type="submit" variant="secondary">{tc("filter")}</Button>
        </form>
        <span className="ms-auto flex gap-2">
          {data.items.length ? <a className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-ink-300 hover:bg-ink-100" href={`/api/v1/print/batch?items=${data.items.map((i) => `invoice:${i.id}`).join(",")}`} target="_blank" rel="noopener">{t("printAllInvoices")}</a> : null}
          <PrintTableButton
            data={{
              title: t("tabs.invoices"),
              columns: [
                { key: "number", label: tc("number") },
                { key: "date", label: t("date"), kind: "num" },
                { key: "due", label: t("dueDate"), kind: "num" },
                { key: "customer", label: t("customer") },
                { key: "order", label: t("order") },
                { key: "status", label: tc("status") },
                { key: "total", label: t("total"), kind: "num" },
                { key: "open", label: t("open"), kind: "num" },
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
              <Th>{t("dueDate")}</Th>
              <Th>{t("customer")}</Th>
              <Th>{t("order")}</Th>
              <Th>{tc("status")}</Th>
              <Th>{t("total")}</Th>
              <Th>{t("open")}</Th>
              <Th>{t("archive")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.items.map((i, idx) => (
              <tr key={i.id} data-testid="invoice-row">
                <Td><Link href={`/admin/documents/invoices/${i.id}`} className="num font-medium text-brand-700 hover:underline">{i.number}</Link></Td>
                <Td className="num">{rows[idx]!.date}</Td>
                <Td className="num">{rows[idx]!.due}</Td>
                <Td><Link href={`/admin/customers/${i.customer.id}`} className="hover:underline">{i.customer.displayName}</Link> <span className="text-xs text-ink-500">{tAll(`channel.${i.channel}`)}</span></Td>
                <Td>{i.order ? <Link href={`/admin/orders/${i.order.id}`} className="num hover:underline">{i.order.number}</Link> : "–"}</Td>
                <Td><Badge tone={TONE[i.status]}>{rows[idx]!.status}</Badge></Td>
                <Td className="num">{rows[idx]!.total}</Td>
                <Td className="num">{rows[idx]!.open}</Td>
                <Td>{i.archivedDocId ? <Badge tone="green">{t("frozen")}</Badge> : <Badge tone="amber">{t("pendingArchive")}</Badge>}</Td>
                <Td><PrintButton href={`/api/v1/documents/invoice/${i.id}`} label="PDF" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="text-sm text-ink-500"><Num>{data.total}</Num></p>
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
