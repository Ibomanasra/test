import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiForm } from "@/components/admin/ApiForm";
import { Forbidden } from "@/components/admin/Forbidden";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText } from "@/server/format";
import { listStocktakes } from "@/server/services/inventory";

export default async function StocktakesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "stock.view");
  if (!auth) return <Forbidden />;
  const [t, tc, items] = await Promise.all([getTranslations("admin.stock"), getTranslations("common"), listStocktakes()]);
  return (
    <div className="space-y-6">
      {hasPermission(auth.permissions, "stock.stocktake") ? (
        <Card title={t("newStocktake")}>
          <p className="mb-3 text-sm text-ink-600">{t("stocktakeHint")}</p>
          <ApiForm
            endpoint="/api/v1/admin/stocktakes"
            testId="new-stocktake"
            submitLabel={t("startStocktake")}
            redirect="/admin/stock/stocktakes/{id}"
            fields={[
              { name: "binPrefix", label: t("binPrefix"), type: "text", dir: "ltr", hint: t("binPrefixHint") },
              { name: "note", label: t("note"), type: "text" },
            ]}
          />
        </Card>
      ) : null}
      {items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr><Th>{tc("number")}</Th><Th>{t("startedAt")}</Th><Th>{tc("status")}</Th><Th>{t("lines")}</Th><Th>{t("note")}</Th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {items.map((s) => (
              <tr key={s.id}>
                <Td><Link href={`/admin/stock/stocktakes/${s.id}`} className="num font-medium text-brand-700 hover:underline">{s.number}</Link></Td>
                <Td className="num">{dateTimeText(s.startedAt)}</Td>
                <Td><Badge tone={s.status === "CLOSED" ? "green" : s.status === "CANCELLED" ? "neutral" : "amber"}>{t(`stocktakeStatus.${s.status}`)}</Badge></Td>
                <Td className="num">{s._count.lines}</Td>
                <Td className="text-sm">{s.note ?? ""}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
