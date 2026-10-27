import { hasPermission } from "@sa/core";
import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiButton, ApiForm } from "@/components/admin/ApiForm";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Badge, Button, Card, EmptyState, Input, Table, Td, Th } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, money } from "@/server/format";
import { listPayments } from "@/server/services/finance";

export default async function PaymentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "finance.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const canPay = hasPermission(auth.permissions, "finance.payment");
  const [t, tc, tAll, data, customers] = await Promise.all([
    getTranslations("admin.finance"),
    getTranslations("common"),
    getTranslations(),
    listPayments({ q: sp.q, page }),
    canPay ? prisma.customer.findMany({ where: { status: "ACTIVE" }, select: { id: true, displayName: true, number: true }, orderBy: { displayName: "asc" }, take: 2000 }) : Promise.resolve([]),
  ]);
  const rows = data.items.map((p) => ({ number: p.number, date: dateTimeText(p.receivedAt), customer: p.customer.displayName, method: tAll(`paymentMethod.${p.method}`), amount: money(p.amount), invoices: p.allocations.map((a) => a.invoice.number).join(" "), reference: p.reference ?? "" }));
  return (
    <div className="space-y-6">
      {canPay ? (
        <Card title={t("recordPayment")}>
          <ApiForm
            endpoint="/api/v1/admin/payments"
            testId="payment"
            submitLabel={t("recordPaymentSubmit")}
            successText={t("paymentRecorded")}
            defaults={{ method: "BANK_TRANSFER" }}
            fields={[
              { name: "customerId", label: t("customer"), type: "select", required: true, options: customers.map((c) => ({ value: c.id, label: `${c.displayName} (${c.number})` })) },
              { name: "method", label: t("method"), type: "select", required: true, options: ["BANK_TRANSFER", "CASH_ON_DELIVERY", "CARD_GATEWAY"].map((m) => ({ value: m, label: tAll(`paymentMethod.${m}`) })) },
              { name: "amount", label: t("amount"), type: "money", required: true },
              { name: "receivedAt", label: t("date"), type: "day" },
              { name: "reference", label: t("reference"), type: "text", dir: "ltr" },
              { name: "note", label: t("note"), type: "text" },
            ]}
          />
          <p className="mt-2 text-xs text-ink-500">{t("allocationHint")}</p>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex gap-2">
          <Input name="q" defaultValue={sp.q} placeholder={t("searchPlaceholder")} className="max-w-xs" />
          <Button type="submit" variant="secondary">{tc("filter")}</Button>
        </form>
        <span className="ms-auto"><PrintTableButton data={{ title: t("tabs.payments"), columns: [{ key: "number", label: tc("number") }, { key: "date", label: t("date"), kind: "num" }, { key: "customer", label: t("customer") }, { key: "method", label: t("method") }, { key: "amount", label: t("amount"), kind: "num" }, { key: "invoices", label: t("invoices") }, { key: "reference", label: t("reference") }], rows }} /></span>
      </div>
      {data.items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>{tc("number")}</Th><Th>{t("date")}</Th><Th>{t("customer")}</Th><Th>{t("method")}</Th><Th>{t("amount")}</Th><Th>{t("invoices")}</Th><Th>{t("receivedBy")}</Th><Th /></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {data.items.map((p, i) => (
              <tr key={p.id} data-testid="payment-row" className={p.voidedAt ? "text-ink-400 line-through" : undefined}>
                <Td className="num">{p.number}</Td>
                <Td className="num">{rows[i]!.date}</Td>
                <Td>{p.customer.displayName}</Td>
                <Td>{rows[i]!.method}{p.reference ? <span className="num block text-xs text-ink-500">{p.reference}</span> : null}</Td>
                <Td className="num font-medium">{rows[i]!.amount}</Td>
                <Td className="num text-xs">{rows[i]!.invoices || <Badge tone="amber">{t("onAccountCredit")}</Badge>}</Td>
                <Td className="text-sm">{p.receivedBy?.name ?? ""}</Td>
                <Td>
                  <span className="flex flex-wrap gap-2">
                    <PrintButton href={`/api/v1/documents/receipt/${p.id}`} label="PDF" />
                    {canPay && !p.voidedAt ? <ApiButton endpoint={`/api/v1/admin/payments/${p.id}/void`} label={t("void")} variant="ghost" promptText={t("voidReason")} /> : null}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
