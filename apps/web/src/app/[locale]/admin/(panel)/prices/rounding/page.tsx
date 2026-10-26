import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { Alert } from "@/components/ui";
import { money, moneyInput } from "@/server/format";
import { pricePage } from "../guard";

const MODES = ["NONE", "END_90", "END_00", "END_50_OR_00", "NEAREST_10"] as const;

export default async function RoundingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale);
  if (!g) return <Forbidden />;
  const [t, tc, rules] = await Promise.all([getTranslations("admin.prices"), getTranslations("common"), prisma.roundingRule.findMany({ orderBy: { sortOrder: "asc" } })]);
  return (
    <div className="space-y-4">
      <Alert tone="blue">{t("roundingNote")}</Alert>
      <CrudManager
        endpoint="/api/v1/admin/prices/rules/rounding"
        canEdit={g.canEdit}
        createLabel={t("newRounding")}
        defaults={{ mode: "END_90", minAgorot: "0", appliesToPromotions: true, appliesToBasePrices: false, active: true, sortOrder: "10" }}
        fields={[
          { name: "mode", label: t("roundingMode"), type: "select", required: true, options: MODES.map((m) => ({ value: m, label: t(`roundingModes.${m}`) })) },
          { name: "minAgorot", label: t("minAmount"), type: "money" },
          { name: "sortOrder", label: t("sortOrder"), type: "int" },
          { name: "appliesToPromotions", label: t("appliesToPromotions"), type: "checkbox" },
          { name: "appliesToBasePrices", label: t("appliesToBasePrices"), type: "checkbox" },
          { name: "active", label: tc("active"), type: "checkbox" },
        ]}
        columns={[
          { key: "mode", label: t("roundingMode") },
          { key: "min", label: t("minAmount"), className: "num" },
          { key: "scope", label: t("appliesTo") },
          { key: "order", label: t("sortOrder"), className: "num" },
          { key: "active", label: tc("status") },
        ]}
        rows={rules.map((r) => ({
          id: r.id,
          tone: r.active ? undefined : "muted",
          values: { mode: r.mode, minAgorot: moneyInput(r.minAgorot), sortOrder: String(r.sortOrder), appliesToPromotions: r.appliesToPromotions, appliesToBasePrices: r.appliesToBasePrices, active: r.active },
          cells: {
            mode: t(`roundingModes.${r.mode}`),
            min: `≥ ${money(r.minAgorot)}`,
            scope: [r.appliesToPromotions ? t("appliesToPromotions") : null, r.appliesToBasePrices ? t("appliesToBasePrices") : null].filter(Boolean).join(" · "),
            order: String(r.sortOrder),
            active: r.active ? tc("active") : tc("inactive"),
          },
        }))}
      />
    </div>
  );
}
