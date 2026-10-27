import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiButton } from "@/components/admin/ApiForm";
import { Forbidden } from "@/components/admin/Forbidden";
import { StocktakeCounter } from "@/components/admin/StocktakeCounter";
import { PrintButton } from "@/components/print/PrintButton";
import { Badge, Card, Num } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText } from "@/server/format";
import { getStocktake } from "@/server/services/inventory";

export default async function StocktakePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "stock.view");
  if (!auth) return <Forbidden />;
  const st = await getStocktake(id).catch(() => notFound());
  const t = await getTranslations("admin.stock");
  const open = st.status === "OPEN" || st.status === "COUNTING";
  const canCount = open && hasPermission(auth.permissions, "stock.stocktake");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="num text-xl font-semibold">{st.number}</h2>
        <Badge tone={open ? "amber" : "green"}>{t(`stocktakeStatus.${st.status}`)}</Badge>
        <span className="text-sm text-ink-600">{dateTimeText(st.startedAt)}</span>
        <span className="ms-auto flex flex-wrap gap-2">
          <PrintButton href={`/api/v1/documents/stocktake/${st.id}`} label={t("countSheet")} testId="print-count-sheet" />
          {canCount ? (
            <>
              <ApiButton endpoint={`/api/v1/admin/stocktakes/${st.id}/close`} label={t("closeStocktake")} variant="primary" confirmText={t("closeConfirm")} testId="close-stocktake" />
              <ApiButton endpoint={`/api/v1/admin/stocktakes/${st.id}/cancel`} label={t("cancelStocktake")} variant="ghost" confirmText={t("cancelConfirm")} />
            </>
          ) : null}
        </span>
      </div>
      <Card>
        <p className="text-sm">
          {t("countedLines")}: <Num>{st.variance.counted}</Num> / <Num>{st.lines.length}</Num> · {t("plus")}: <Num>{st.variance.plus}</Num> · {t("minus")}: <Num>{st.variance.minus}</Num>
        </p>
      </Card>
      <StocktakeCounter
        stocktakeId={st.id}
        editable={canCount}
        lines={st.lines.map((l) => ({
          id: l.id,
          bin: l.bin?.code ?? "",
          sku: l.variant.sku,
          name: [locale === "ar" ? l.variant.product.nameAr : l.variant.product.nameEn, locale === "ar" ? l.variant.nameAr : l.variant.nameEn].filter(Boolean).join(" – "),
          expected: l.expectedQty,
          counted: l.countedQty,
        }))}
      />
    </div>
  );
}
