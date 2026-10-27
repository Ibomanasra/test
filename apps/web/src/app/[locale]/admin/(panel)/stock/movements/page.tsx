import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Badge, Button, EmptyState, Input, Select, Table, Td, Th } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText } from "@/server/format";
import { listMovements } from "@/server/services/inventory";

const TYPES = ["RECEIPT", "SALE", "RETURN", "ADJUSTMENT", "STOCKTAKE"] as const;

export default async function MovementsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "stock.view"))) return <Forbidden />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, tc, data] = await Promise.all([getTranslations("admin.stock"), getTranslations("common"), listMovements({ sku: sp.sku, type: TYPES.includes(sp.type as never) ? sp.type : undefined, page })]);
  const rows = data.items.map((m) => ({ at: dateTimeText(m.createdAt), sku: m.variant.sku, type: t(`movement.${m.type}`), qty: m.qtyBase, bin: m.bin?.code ?? "", note: m.note ?? "", by: m.by }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-wrap gap-2">
          <Input name="sku" defaultValue={sp.sku} placeholder="SKU" dir="ltr" className="num max-w-40" />
          <Select name="type" defaultValue={sp.type ?? ""} className="w-auto">
            <option value="">{tc("type")}: {tc("all")}</option>
            {TYPES.map((x) => <option key={x} value={x}>{t(`movement.${x}`)}</option>)}
          </Select>
          <Button type="submit" variant="secondary">{tc("filter")}</Button>
        </form>
        <span className="ms-auto">
          <PrintTableButton data={{ title: t("tabs.movements"), columns: [{ key: "at", label: t("at"), kind: "num" }, { key: "sku", label: "SKU" }, { key: "type", label: tc("type") }, { key: "qty", label: t("qty"), kind: "num" }, { key: "bin", label: t("bin") }, { key: "note", label: t("note") }, { key: "by", label: t("by") }], rows }} />
        </span>
      </div>
      {data.items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr><Th>{t("at")}</Th><Th>SKU</Th><Th>{tc("type")}</Th><Th>{t("qty")}</Th><Th>{t("bin")}</Th><Th>{t("note")}</Th><Th>{t("by")}</Th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r, i) => (
              <tr key={data.items[i]!.id}>
                <Td className="num">{r.at}</Td>
                <Td className="num">{r.sku}</Td>
                <Td><Badge tone={r.qty > 0 ? "green" : "neutral"}>{r.type}</Badge></Td>
                <Td className={`num font-medium ${r.qty < 0 ? "text-red-700" : "text-green-700"}`}>{r.qty > 0 ? `+${r.qty}` : r.qty}</Td>
                <Td className="num">{r.bin || "–"}</Td>
                <Td className="text-sm">{r.note}</Td>
                <Td className="text-sm">{r.by}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
