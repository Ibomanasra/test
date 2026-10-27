import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listSuppliers } from "@/server/services/inventory";

export default async function SuppliersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "purchase.view");
  if (!auth) return <Forbidden />;
  const [t, tc, suppliers] = await Promise.all([getTranslations("admin.purchasing"), getTranslations("common"), listSuppliers()]);
  return (
    <CrudManager
      endpoint="/api/v1/admin/suppliers"
      canEdit={hasPermission(auth.permissions, "purchase.edit")}
      createLabel={t("newSupplier")}
      deletable={false}
      testId="suppliers"
      defaults={{ active: true }}
      fields={[
        { name: "name", label: tc("name"), type: "text", required: true },
        { name: "contactName", label: t("contactName"), type: "text" },
        { name: "phone", label: tc("phone"), type: "text", dir: "ltr" },
        { name: "email", label: t("email"), type: "text", dir: "ltr" },
        { name: "dealerNumber", label: t("dealerNumber"), type: "text", dir: "ltr" },
        { name: "address", label: t("address"), type: "text" },
        { name: "paymentTermDays", label: t("paymentTerms"), type: "int" },
        { name: "active", label: tc("active"), type: "checkbox" },
      ]}
      columns={[
        { key: "number", label: tc("number"), className: "num" },
        { key: "name", label: tc("name") },
        { key: "phone", label: tc("phone"), className: "num" },
        { key: "orders", label: t("tabs.orders"), className: "num" },
      ]}
      rows={suppliers.map((s) => ({
        id: s.id,
        tone: s.active ? undefined : "muted",
        values: { name: s.name, contactName: s.contactName ?? "", phone: s.phone ?? "", email: s.email ?? "", dealerNumber: s.dealerNumber ?? "", address: s.address ?? "", paymentTermDays: s.paymentTermDays?.toString() ?? "", active: s.active },
        cells: { number: s.number, name: s.name, phone: s.phone ?? "–", orders: String(s._count.purchaseOrders) },
      }))}
    />
  );
}
