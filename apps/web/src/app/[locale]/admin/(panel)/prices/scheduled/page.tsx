import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { day, money } from "@/server/format";
import { priceOptions } from "@/server/services/price-options";
import { pricePage } from "../guard";

export default async function ScheduledPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale);
  if (!g) return <Forbidden />;
  const [t, tc, opts, rows] = await Promise.all([
    getTranslations("admin.prices"),
    getTranslations("common"),
    priceOptions(locale),
    prisma.scheduledPriceChange.findMany({ orderBy: { effectiveAt: "desc" }, take: 300, include: { variant: { select: { sku: true } } } }),
  ]);
  const fields = (["B2C", "B2B_BASE", ...(g.canSeeCost ? ["COST"] : [])] as const).map((f) => ({ value: f, label: t(`fieldNames.${f}`) }));
  return (
    <CrudManager
      endpoint="/api/v1/admin/prices/rules/scheduled"
      canEdit={g.canEdit}
      createLabel={t("newScheduled")}
      skuOptions={opts.skuOptions}
      deleteLabel={tc("cancel")}
      defaults={{ field: "B2C" }}
      fields={[
        { name: "sku", label: t("sku"), type: "sku", required: true },
        { name: "field", label: t("field"), type: "select", required: true, options: fields },
        { name: "newPrice", label: t("newPrice"), type: "money", required: true },
        { name: "effectiveAt", label: t("effectiveAt"), type: "day", required: true },
      ]}
      columns={[
        { key: "variant", label: t("product") },
        { key: "field", label: t("field") },
        { key: "price", label: t("newPrice"), className: "num" },
        { key: "at", label: t("effectiveAt"), className: "num" },
        { key: "status", label: tc("status") },
      ]}
      rows={rows
        .filter((r) => g.canSeeCost || r.field !== "COST")
        .map((r) => ({
          id: r.id,
          tone: r.appliedAt || r.cancelledAt ? ("muted" as const) : undefined,
          values: { sku: r.variant.sku, field: r.field, newPrice: "", effectiveAt: day(r.effectiveAt) },
          cells: {
            variant: opts.variantLabel.get(r.variantId) ?? r.variant.sku,
            field: t(`fieldNames.${r.field as "B2C" | "B2B_BASE" | "COST"}`),
            price: money(r.newPrice),
            at: day(r.effectiveAt),
            status: r.cancelledAt ? t("scheduledStatus.cancelled") : r.appliedAt ? `${t("scheduledStatus.applied")} ${day(r.appliedAt)}` : t("scheduledStatus.pending"),
          },
        }))}
    />
  );
}
