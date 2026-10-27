import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiForm } from "@/components/admin/ApiForm";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { Card } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listBins } from "@/server/services/inventory";

export default async function BinsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "stock.view");
  if (!auth) return <Forbidden />;
  const canEdit = hasPermission(auth.permissions, "stock.bins");
  const [t, tc, bins] = await Promise.all([getTranslations("admin.stock"), getTranslations("common"), listBins()]);
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-600">{t("binsHint")}</p>
      <CrudManager
        endpoint="/api/v1/admin/stock/bins"
        canEdit={canEdit}
        createLabel={t("newBin")}
        defaults={{ active: true, sortKey: "0" }}
        fields={[
          { name: "code", label: t("binCode"), type: "text", required: true, dir: "ltr" },
          { name: "sortKey", label: t("sortKey"), type: "int", required: true, hint: t("sortKeyHint") },
          { name: "active", label: tc("active"), type: "checkbox" },
        ]}
        columns={[
          { key: "code", label: t("binCode"), className: "num" },
          { key: "sortKey", label: t("sortKey"), className: "num" },
          { key: "variants", label: t("variantsInBin"), className: "num" },
        ]}
        rows={bins.map((b) => ({ id: b.id, tone: b.active ? undefined : "muted", values: { code: b.code, sortKey: String(b.sortKey), active: b.active }, cells: { code: b.code, sortKey: String(b.sortKey), variants: String(b._count.defaultFor) } }))}
      />
      {canEdit ? (
        <Card title={t("assignBin")}>
          <ApiForm
            endpoint="/api/v1/admin/stock/variant-bin"
            submitLabel={tc("save")}
            successText={tc("saved")}
            fields={[
              { name: "sku", label: "SKU", type: "text", required: true, dir: "ltr" },
              { name: "binId", label: t("bin"), type: "select", options: bins.filter((b) => b.active).map((b) => ({ value: b.id, label: b.code })) },
            ]}
          />
        </Card>
      ) : null}
    </div>
  );
}
