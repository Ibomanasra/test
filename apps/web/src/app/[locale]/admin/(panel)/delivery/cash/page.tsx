import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiButton } from "@/components/admin/ApiForm";
import { Forbidden } from "@/components/admin/Forbidden";
import { PrintButton } from "@/components/print/PrintButton";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { cashByDriver, listCashClosings } from "@/server/services/delivery";

export default async function CashPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "delivery.cash_closing", "delivery.view_all");
  if (!auth) return <Forbidden />;
  const [t, tc, closings, open] = await Promise.all([getTranslations("admin.delivery"), getTranslations("common"), listCashClosings(), cashByDriver()]);
  const canApprove = hasPermission(auth.permissions, "delivery.cash_closing");
  return (
    <div className="space-y-6">
      <Card title={t("cashWithDrivers")}>
        {open.length === 0 ? <p className="text-sm text-ink-500">–</p> : (
          <ul className="space-y-1 text-sm">{open.map((d) => <li key={d.driverId}>{d.name}: <span className="num font-semibold">{money(d.amount)}</span></li>)}</ul>
        )}
      </Card>
      {closings.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>{tc("number")}</Th><Th>{t("date")}</Th><Th>{t("driver")}</Th><Th>{t("expected")}</Th><Th>{t("counted")}</Th><Th>{t("difference")}</Th><Th>{tc("status")}</Th><Th /></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {closings.map((c) => (
              <tr key={c.id} data-testid="closing-row">
                <Td className="num">{c.number}</Td>
                <Td className="num">{day(c.date)}</Td>
                <Td>{c.driver.name}</Td>
                <Td className="num">{money(c.expected)}</Td>
                <Td className="num">{c.counted == null ? "–" : money(c.counted)}</Td>
                <Td className={`num font-medium ${c.difference ? "text-red-700" : ""}`}>{c.difference == null ? "–" : money(c.difference)}</Td>
                <Td><Badge tone={c.status === "APPROVED" ? "green" : c.status === "SUBMITTED" ? "amber" : "neutral"}>{t(`closingStatus.${c.status}`)}</Badge></Td>
                <Td>
                  <span className="flex flex-wrap gap-2">
                    <PrintButton href={`/api/v1/documents/cash-closing/${c.id}`} label="PDF" />
                    {canApprove && c.status === "SUBMITTED" ? <ApiButton endpoint={`/api/v1/admin/cash-closings/${c.id}/approve`} label={t("approve")} variant="primary" testId="approve-closing" /> : null}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
