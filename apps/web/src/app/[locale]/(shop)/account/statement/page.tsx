import { getTranslations, setRequestLocale } from "next-intl/server";
import { Alert, Card, EmptyState, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { customerStatement } from "@/server/services/statement";

export const dynamic = "force-dynamic";

export default async function StatementPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireCustomerPage(locale, "/account/statement");
  const t = await getTranslations("account.statement");
  if (auth.channel !== "B2B") return <Alert tone="amber">{(await getTranslations("account.quotes"))("b2bOnly")}</Alert>;
  const sp = await searchParams;
  const s = await customerStatement(auth.customer!.id, sp.from, sp.to);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={`${s.from} → ${s.to}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-500">{t("opening")}</p><p className="num text-xl font-semibold">{money(s.opening)}</p></Card>
        <Card><p className="text-sm text-ink-500">{t("closing")}</p><p className="num text-xl font-semibold" data-testid="balance">{money(s.closing)}</p></Card>
        <Card><p className="text-sm text-ink-500">{t("overdue")}</p><p className="num text-xl font-semibold text-red-700">{money(s.overdue)}</p></Card>
      </div>
      {s.entries.length === 0 ? (
        <EmptyState>{t("none")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("date")}</Th>
              <Th>{t("document")}</Th>
              <Th>{t("debit")}</Th>
              <Th>{t("credit")}</Th>
              <Th>{t("balance")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {s.entries.map((e) => (
              <tr key={e.id}>
                <Td><Num>{day(e.date)}</Num></Td>
                <Td>{t(`types.${e.type}`)} <span className="num">{e.refNumber ?? ""}</span></Td>
                <Td className="num">{e.debit ? money(e.debit) : ""}</Td>
                <Td className="num">{e.credit ? money(e.credit) : ""}</Td>
                <Td className="num">{money(e.balance)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
