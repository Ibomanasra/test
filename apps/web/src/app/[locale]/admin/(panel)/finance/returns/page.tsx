import { hasPermission } from "@sa/core";
import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { ReturnForm } from "@/components/admin/ReturnForm";
import { PrintButton } from "@/components/print/PrintButton";
import { Alert, Button, Card, EmptyState, Input, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, money } from "@/server/format";
import { listReturns } from "@/server/services/finance";

export default async function ReturnsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "finance.view", "finance.credit_note");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const [t, tc, returns] = await Promise.all([getTranslations("admin.finance"), getTranslations("common"), listReturns()]);
  const canCreate = hasPermission(auth.permissions, "finance.credit_note");
  const order = canCreate && sp.order
    ? await prisma.order.findFirst({ where: { number: sp.order.trim().toUpperCase() }, include: { items: { orderBy: { sortOrder: "asc" }, include: { returnItems: { select: { qtyBase: true } } } } } })
    : null;
  return (
    <div className="space-y-6">
      {canCreate ? (
        <Card title={t("newReturn")}>
          <form method="get" className="flex gap-2">
            <Input name="order" defaultValue={sp.order} placeholder="SO-2026-000001" dir="ltr" className="num max-w-xs" aria-label={t("orderNumber")} />
            <Button type="submit" variant="secondary">{t("findOrder")}</Button>
          </form>
          {sp.order && !order ? <div className="mt-3"><Alert tone="amber">{tc("noResults")}</Alert></div> : null}
        </Card>
      ) : null}
      {order ? (
        <ReturnForm
          orderId={order.id}
          items={order.items.map((i) => ({ id: i.id, sku: i.skuSnapshot, name: locale === "ar" ? i.nameArSnapshot : i.nameEnSnapshot, returnable: Math.max(0, i.qtyDeliveredBase - i.returnItems.reduce((a, r) => a + r.qtyBase, 0)) }))}
        />
      ) : null}
      {returns.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>{tc("number")}</Th><Th>{t("date")}</Th><Th>{t("customer")}</Th><Th>{t("order")}</Th><Th>{t("reason")}</Th><Th>{t("creditNote")}</Th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {returns.map((r) => (
              <tr key={r.id} data-testid="return-row">
                <Td className="num">{r.number}</Td>
                <Td className="num">{dateTimeText(r.createdAt)}</Td>
                <Td>{r.customer.displayName}</Td>
                <Td><Link href={`/admin/orders/${r.order.id}`} className="num text-brand-700 hover:underline">{r.order.number}</Link></Td>
                <Td className="text-sm">{r.reason}{r.restock ? "" : ` · ${t("noRestock")}`}</Td>
                <Td>{r.creditNote ? <span className="flex items-center gap-2"><span className="num">{r.creditNote.number} · {money(r.creditNote.totalGross)}</span><PrintButton href={`/api/v1/documents/credit-note/${r.creditNote.id}`} label="PDF" /></span> : "–"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
