import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiForm } from "@/components/admin/ApiForm";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Badge, Button, Card, EmptyState, Input, Num, Table, Td, Th } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { money } from "@/server/format";
import { listStock } from "@/server/services/inventory";

export default async function StockPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "stock.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, tc, data] = await Promise.all([getTranslations("admin.stock"), getTranslations("common"), listStock({ q: sp.q, low: sp.low === "1", page })]);
  const seeCost = hasPermission(auth.permissions, "price.view_cost");
  const name = (v: (typeof data.items)[number]) => [locale === "ar" ? v.product.nameAr : v.product.nameEn, locale === "ar" ? v.nameAr : v.nameEn].filter(Boolean).join(" – ");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Input name="q" defaultValue={sp.q} placeholder={t("searchPlaceholder")} className="max-w-xs" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="low" value="1" defaultChecked={sp.low === "1"} className="accent-brand-700" />{t("lowOnly")}</label>
          <Button type="submit" variant="secondary">{tc("filter")}</Button>
        </form>
        <span className="ms-auto flex flex-wrap gap-2">
          <PrintButton href="/api/v1/documents/stock-list/all" label={t("stockListPdf")} />
          <PrintTableButton
            data={{
              title: t("title"),
              columns: [
                { key: "sku", label: "SKU" },
                { key: "name", label: t("product") },
                { key: "bin", label: t("bin") },
                { key: "onHand", label: t("onHand"), kind: "num" },
                { key: "reserved", label: t("reserved"), kind: "num" },
                { key: "available", label: t("available"), kind: "num" },
                { key: "min", label: t("minStock"), kind: "num" },
              ],
              rows: data.items.map((v) => ({ sku: v.sku, name: name(v), bin: v.defaultBin?.code ?? "", onHand: v.onHand, reserved: v.reserved, available: v.available, min: v.minStock })),
            }}
          />
        </span>
      </div>
      {seeCost ? <p className="text-sm text-ink-600">{t("totalValue")}: <span className="num font-semibold">{money(data.totalValue)}</span></p> : null}
      {data.items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>{t("product")}</Th>
              <Th>{t("bin")}</Th>
              <Th>{t("onHand")}</Th>
              <Th>{t("reserved")}</Th>
              <Th>{t("available")}</Th>
              <Th>{t("minStock")}</Th>
              {seeCost ? <Th>{t("value")}</Th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.items.map((v) => (
              <tr key={v.id} data-testid="stock-row" className={v.low && v.active ? "bg-amber-50" : undefined}>
                <Td className="num">{v.sku}</Td>
                <Td>{name(v)}{v.low && v.active ? <span className="ms-2"><Badge tone="amber">{t("low")}</Badge></span> : null}</Td>
                <Td className="num">{v.defaultBin?.code ?? "–"}</Td>
                <Td className="num">{v.onHand}</Td>
                <Td className="num">{v.reserved}</Td>
                <Td className="num font-medium">{v.available}</Td>
                <Td className="num">{v.minStock}</Td>
                {seeCost ? <Td className="num">{money(v.value)}</Td> : null}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="text-sm text-ink-500"><Num>{data.total}</Num></p>
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
      {hasPermission(auth.permissions, "stock.adjust") ? (
        <Card title={t("adjust")}>
          <p className="mb-3 text-sm text-ink-600">{t("adjustHint")}</p>
          <ApiForm
            endpoint="/api/v1/admin/stock/adjust"
            testId="adjust"
            submitLabel={t("adjustSubmit")}
            successText={t("adjusted")}
            fields={[
              { name: "sku", label: "SKU", type: "text", required: true, dir: "ltr" },
              { name: "qtyBase", label: t("qtyDelta"), type: "int", required: true, hint: t("qtyDeltaHint") },
              { name: "reason", label: t("reason"), type: "text", required: true },
            ]}
          />
        </Card>
      ) : null}
    </div>
  );
}
