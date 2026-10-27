import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiButton } from "@/components/admin/ApiForm";
import { Forbidden } from "@/components/admin/Forbidden";
import { GoodsReceiptForm } from "@/components/admin/PurchaseOrderEditor";
import { PrintButton } from "@/components/print/PrintButton";
import { Badge, Card, Num, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, day, money, moneyInput } from "@/server/format";
import { getPurchaseOrder, listBins } from "@/server/services/inventory";

export default async function PurchaseOrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "purchase.view");
  if (!auth) return <Forbidden />;
  const po = await getPurchaseOrder(id).catch(() => notFound());
  const [t, tAll, bins] = await Promise.all([getTranslations("admin.purchasing"), getTranslations(), listBins()]);
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(auth.permissions, p);
  const name = (i: (typeof po.items)[number]) => [locale === "ar" ? i.variant.product.nameAr : i.variant.product.nameEn, locale === "ar" ? i.variant.nameAr : i.variant.nameEn].filter(Boolean).join(" – ");
  const receivable = po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="num text-xl font-semibold">{po.number}</h2>
        <Badge>{t(`status.${po.status}`)}</Badge>
        <span className="text-sm text-ink-600">{po.supplier.name}</span>
        <span className="ms-auto flex flex-wrap gap-2">
          <PrintButton href={`/api/v1/documents/purchase-order/${po.id}`} testId="print-po" />
          {po.status === "DRAFT" && can("purchase.edit") ? (
            <>
              <Link href={`/admin/purchasing/${po.id}/edit`} className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-ink-300">{tAll("common.edit")}</Link>
              <ApiButton endpoint={`/api/v1/admin/purchase-orders/${po.id}/status`} body={{ to: "ORDERED" }} label={t("markOrdered")} variant="primary" testId="po-order" />
            </>
          ) : null}
          {(po.status === "DRAFT" || po.status === "ORDERED") && can("purchase.edit") ? <ApiButton endpoint={`/api/v1/admin/purchase-orders/${po.id}/status`} body={{ to: "CANCELLED" }} label={t("cancel")} variant="ghost" confirmText={t("cancelConfirm")} /> : null}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-500">{t("date")}</p><p className="num">{day(po.orderedAt ?? po.createdAt)}</p></Card>
        <Card><p className="text-sm text-ink-500">{t("expectedAt")}</p><p className="num">{day(po.expectedAt) || "–"}</p></Card>
        <Card><p className="text-sm text-ink-500">{t("total")}</p><p className="num font-semibold">{money(po.totalGross)}</p><p className="num text-xs text-ink-500">{money(po.subtotalNet)} + {money(po.vatTotal)}</p></Card>
      </div>
      <Table>
        <thead><tr><Th>SKU</Th><Th>{t("product")}</Th><Th>{t("qty")}</Th><Th>{t("unitCost")}</Th><Th>{t("receivedQty")}</Th></tr></thead>
        <tbody className="divide-y divide-ink-100">
          {po.items.map((i) => (
            <tr key={i.id}>
              <Td className="num">{i.variant.sku}</Td>
              <Td>{name(i)}</Td>
              <Td className="num">{i.qty} × {tAll(`units.${i.unitCode}`)} ({i.unitFactor})</Td>
              <Td className="num">{money(i.unitCostNet * i.unitFactor)}</Td>
              <Td className="num">{i.receivedQtyBase} / {i.qty * i.unitFactor}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {receivable && can("stock.receive") ? (
        <GoodsReceiptForm
          poId={po.id}
          bins={bins.filter((b) => b.active).map((b) => ({ value: b.id, label: b.code }))}
          items={po.items.map((i) => ({ id: i.id, sku: i.variant.sku, name: name(i), open: Math.max(0, i.qty * i.unitFactor - i.receivedQtyBase), unitCost: moneyInput(i.unitCostNet), binId: i.variant.defaultBinId ?? "" }))}
        />
      ) : null}
      {po.receipts.length ? (
        <Card title={t("receipts")}>
          <ul className="space-y-1 text-sm">
            {po.receipts.map((r) => (
              <li key={r.id}><span className="num font-medium">{r.number}</span> · <Num>{dateTimeText(r.receivedAt)}</Num> · {r.items.length} · {t(`costMode.${r.costUpdateMode}`)}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
