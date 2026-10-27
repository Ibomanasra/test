import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Forbidden } from "@/components/admin/Forbidden";
import { PurchaseOrderEditor } from "@/components/admin/PurchaseOrderEditor";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, moneyInput } from "@/server/format";
import { getPurchaseOrder, listSuppliers } from "@/server/services/inventory";
import { quoteEditorOptions } from "@/server/services/quote-options";

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "purchase.edit"))) return <Forbidden />;
  const po = await getPurchaseOrder(id).catch(() => notFound());
  if (po.status !== "DRAFT") notFound();
  const [suppliers, opts] = await Promise.all([listSuppliers(), quoteEditorOptions(locale)]);
  return (
    <PurchaseOrderEditor
      poId={po.id}
      suppliers={suppliers.map((s) => ({ value: s.id, label: s.name }))}
      skuOptions={opts.skuOptions}
      unitNames={opts.unitNames}
      initial={{ supplierId: po.supplierId, expectedAt: day(po.expectedAt), note: po.note ?? "", items: po.items.map((i) => ({ sku: i.variant.sku, unitCode: i.unitCode, qty: String(i.qty), unitCost: moneyInput(i.unitCostNet * i.unitFactor) })) }}
    />
  );
}
