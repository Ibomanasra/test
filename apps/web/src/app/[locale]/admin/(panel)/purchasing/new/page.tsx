import { setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { PurchaseOrderEditor } from "@/components/admin/PurchaseOrderEditor";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listSuppliers } from "@/server/services/inventory";
import { quoteEditorOptions } from "@/server/services/quote-options";

export default async function NewPurchaseOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "purchase.edit"))) return <Forbidden />;
  const [suppliers, opts] = await Promise.all([listSuppliers(), quoteEditorOptions(locale)]);
  return <PurchaseOrderEditor suppliers={suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))} skuOptions={opts.skuOptions} unitNames={opts.unitNames} />;
}
