import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { Badge, Button, EmptyState, Input, Num, Table, Td, Th } from "@/components/ui";
import { dateTimeText, money } from "@/server/format";
import { listPriceHistory } from "@/server/services/prices-admin";
import { pricePage } from "../guard";

export default async function HistoryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ sku?: string; page?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale);
  if (!g) return <Forbidden />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, tc, data] = await Promise.all([getTranslations("admin.prices"), getTranslations("common"), listPriceHistory({ sku: sp.sku, page })]);
  const items = data.items.filter((h) => g.canSeeCost || h.field !== "COST");
  return (
    <div className="space-y-4">
      <form method="get" className="flex gap-2">
        <Input name="sku" defaultValue={sp.sku} placeholder={t("sku")} dir="ltr" className="max-w-xs" />
        <Button type="submit" variant="secondary">{tc("filter")}</Button>
      </form>
      {items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("historyTime")}</Th>
              <Th>{t("sku")}</Th>
              <Th>{t("field")}</Th>
              <Th>{t("oldPrice")}</Th>
              <Th>{t("newPrice")}</Th>
              <Th>{t("source")}</Th>
              <Th>{t("changedBy")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {items.map((h) => (
              <tr key={h.id} data-testid="history-row">
                <Td><Num>{dateTimeText(h.changedAt)}</Num></Td>
                <Td><Num>{h.variant.sku}</Num></Td>
                <Td>{t(`historyFields.${h.field}`)}</Td>
                <Td className="num">{money(h.oldPrice)}</Td>
                <Td className="num">{money(h.newPrice)}</Td>
                <Td>
                  {t(`sources.${h.source}`)}
                  {h.belowMarginConfirmed ? <span className="ms-1"><Badge tone="amber">{t("belowMarginBadge")}</Badge></span> : null}
                </Td>
                <Td>{h.changedBy?.name ?? t("system")}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
