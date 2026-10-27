import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CreditNoteForm } from "@/components/admin/CreditNoteForm";
import { Forbidden } from "@/components/admin/Forbidden";
import { PrintButton } from "@/components/print/PrintButton";
import { Badge, Card, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, day, money } from "@/server/format";
import { getInvoiceDetail } from "@/server/services/invoicing";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "finance.view");
  if (!auth) return <Forbidden />;
  const inv = await getInvoiceDetail(id).catch(() => notFound());
  const [t, tAll] = await Promise.all([getTranslations("admin.documents"), getTranslations()]);
  const open = Math.max(0, inv.totalGross - inv.paidAmount - inv.creditedAmount);
  return (
    <div className="space-y-6">
      <PageHeader
        title={<Num>{inv.number}</Num>}
        subtitle={`${inv.customer.displayName} · ${day(inv.issueDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{t(`invoiceStatus.${inv.status}`)}</Badge>
            <PrintButton href={`/api/v1/documents/invoice/${inv.id}`} testId="print-invoice" />
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t("customer")}>
          <Link href={`/admin/customers/${inv.customer.id}`} className="text-brand-700 hover:underline">{inv.customer.displayName}</Link> <span className="num text-xs text-ink-500">{inv.customer.number}</span>
          <p className="mt-2 text-sm">{tAll(`paymentMethod.${inv.paymentMethod}`)} · {t("dueDate")}: <Num>{day(inv.dueDate)}</Num></p>
          {inv.order ? <p className="text-sm">{t("order")}: <Link href={`/admin/orders/${inv.order.id}`} className="num hover:underline">{inv.order.number}</Link>{inv.shipment ? <> · <span className="num">{inv.shipment.number}</span></> : null}</p> : null}
        </Card>
        <Card title={t("amounts")}>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between"><span>{t("net")}</span><span className="num">{money(inv.subtotalNet)}</span></p>
            <p className="flex justify-between"><span>{t("vat")}</span><span className="num">{money(inv.vatTotal)}</span></p>
            <p className="flex justify-between font-semibold"><span>{t("total")}</span><span className="num">{money(inv.totalGross)}</span></p>
            <p className="flex justify-between text-ink-600"><span>{t("paid")}</span><span className="num">{money(inv.paidAmount)}</span></p>
            <p className="flex justify-between text-ink-600"><span>{t("credited")}</span><span className="num">{money(inv.creditedAmount)}</span></p>
            <p className="flex justify-between font-semibold"><span>{t("open")}</span><span className="num" data-testid="invoice-open">{money(open)}</span></p>
          </div>
        </Card>
        <Card title={t("archive")}>
          {inv.archivedDoc ? (
            <div className="space-y-1 text-sm">
              <Badge tone="green">{t("frozen")}</Badge>
              <p>{dateTimeText(inv.archivedDoc.createdAt)} · {inv.archivedDoc.language}</p>
              <p className="num break-all text-xs text-ink-500">SHA-256 {inv.archivedDoc.sha256}</p>
            </div>
          ) : (
            <Badge tone="amber">{t("pendingArchive")}</Badge>
          )}
          <p className="mt-2 text-xs text-ink-500">{t("immutableHint")}</p>
        </Card>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>{t("item")}</Th>
            <Th>{t("qty")}</Th>
            <Th>{t("unitNet")}</Th>
            <Th>{t("net")}</Th>
            <Th>{t("vat")}</Th>
            <Th>{t("total")}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {inv.lines.map((l) => (
            <tr key={l.id}>
              <Td className="num">{l.sku === "DELIVERY" ? "–" : l.sku}</Td>
              <Td>{locale === "ar" ? l.nameAr : l.nameEn}</Td>
              <Td className="num">{l.qty} × {tAll(`units.${l.unitCode}`)}{l.unitFactor > 1 ? ` (${l.unitFactor})` : ""}</Td>
              <Td className="num">{money(l.unitPriceNet * l.unitFactor)}</Td>
              <Td className="num">{money(l.lineNet)}</Td>
              <Td className="num">{money(l.lineVat)}</Td>
              <Td className="num">{money(l.lineGross)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {inv.creditNotes.length ? (
        <Card title={t("tabs.creditNotes")}>
          <ul className="space-y-2 text-sm">
            {inv.creditNotes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span className="num font-medium">{c.number}</span> · <Num>{day(c.issueDate)}</Num> · <span className="num">{money(c.totalGross)}</span> · {c.reason}
                <PrintButton href={`/api/v1/documents/credit-note/${c.id}`} label="PDF" />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {hasPermission(auth.permissions, "finance.credit_note") && inv.status !== "CREDITED" ? (
        <CreditNoteForm invoiceId={inv.id} lines={inv.lines.map((l) => ({ id: l.id, sku: l.sku, name: locale === "ar" ? l.nameAr : l.nameEn, qtyBase: l.qtyBase, creditedQtyBase: l.creditedQtyBase, lineGross: money(l.lineGross) }))} />
      ) : null}
    </div>
  );
}
