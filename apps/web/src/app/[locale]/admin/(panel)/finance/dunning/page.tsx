import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { PrintButton } from "@/components/print/PrintButton";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { listDunningNotices } from "@/server/services/finance";

export default async function DunningPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "finance.view", "finance.dunning"))) return <Forbidden />;
  const [t, tc, items] = await Promise.all([getTranslations("admin.finance"), getTranslations("common"), listDunningNotices()]);
  return items.length === 0 ? (
    <EmptyState>{tc("noResults")}</EmptyState>
  ) : (
    <div className="space-y-3">
      {items.length > 1 ? <a className="inline-block rounded-lg px-3 py-1.5 text-sm ring-1 ring-ink-300" href={`/api/v1/print/batch?items=${items.slice(0, 100).map((n) => `dunning:${n.id}`).join(",")}`} target="_blank" rel="noopener">🖨 {t("printAllDunning")}</a> : null}
      <Table>
        <thead><tr><Th>{tc("number")}</Th><Th>{t("date")}</Th><Th>{t("customer")}</Th><Th>{t("level")}</Th><Th>{t("invoices")}</Th><Th>{t("amount")}</Th><Th /></tr></thead>
        <tbody className="divide-y divide-ink-100">
          {items.map((n) => (
            <tr key={n.id} data-testid="dunning-row">
              <Td className="num">{n.number}</Td>
              <Td className="num">{day(n.issuedAt)}</Td>
              <Td>{n.customer.displayName}</Td>
              <Td><Badge tone={n.level >= 3 ? "red" : n.level === 2 ? "amber" : "neutral"}>{n.level}</Badge></Td>
              <Td className="num">{n.invoices.length}</Td>
              <Td className="num">{money(n.invoices.reduce((a, i) => a + i.openAmount, 0) + n.feeAgorot)}</Td>
              <Td><PrintButton href={`/api/v1/documents/dunning/${n.id}`} label="PDF" /></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
