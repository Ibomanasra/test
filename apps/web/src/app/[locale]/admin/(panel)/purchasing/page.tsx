import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { listPurchaseOrders } from "@/server/services/inventory";

const TONE = { DRAFT: "neutral", ORDERED: "blue", PARTIALLY_RECEIVED: "amber", RECEIVED: "green", CANCELLED: "red" } as const;

export default async function PurchaseOrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "purchase.view");
  if (!auth) return <Forbidden />;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [t, tc, data] = await Promise.all([getTranslations("admin.purchasing"), getTranslations("common"), listPurchaseOrders({ page })]);
  const rows = data.items.map((p) => ({ number: p.number, supplier: p.supplier.name, status: t(`status.${p.status}`), date: day(p.orderedAt ?? p.createdAt), expected: day(p.expectedAt), total: money(p.totalGross) }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {hasPermission(auth.permissions, "purchase.edit") ? <Link href="/admin/purchasing/new" className="rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white" data-testid="new-po">{t("newOrder")}</Link> : null}
        <span className="ms-auto"><PrintTableButton data={{ title: t("tabs.orders"), columns: [{ key: "number", label: tc("number") }, { key: "supplier", label: t("supplier") }, { key: "status", label: tc("status") }, { key: "date", label: t("date"), kind: "num" }, { key: "expected", label: t("expectedAt"), kind: "num" }, { key: "total", label: t("total"), kind: "num" }], rows }} /></span>
      </div>
      {data.items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>{tc("number")}</Th><Th>{t("supplier")}</Th><Th>{tc("status")}</Th><Th>{t("date")}</Th><Th>{t("expectedAt")}</Th><Th>{t("lines")}</Th><Th>{t("total")}</Th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {data.items.map((p, i) => (
              <tr key={p.id} data-testid="po-row">
                <Td><Link href={`/admin/purchasing/${p.id}`} className="num font-medium text-brand-700 hover:underline">{p.number}</Link></Td>
                <Td>{p.supplier.name}</Td>
                <Td><Badge tone={TONE[p.status]}>{rows[i]!.status}</Badge></Td>
                <Td className="num">{rows[i]!.date}</Td>
                <Td className="num">{rows[i]!.expected || "–"}</Td>
                <Td className="num">{p._count.items}</Td>
                <Td className="num">{rows[i]!.total}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
