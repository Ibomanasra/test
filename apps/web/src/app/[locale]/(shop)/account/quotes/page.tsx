import { getTranslations, setRequestLocale } from "next-intl/server";
import { QuoteRequestForm } from "@/components/shop/QuoteRequestForm";
import { Alert, Badge, EmptyState, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { listQuotes } from "@/server/services/quotes";

export const dynamic = "force-dynamic";

export default async function AccountQuotesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireCustomerPage(locale, "/account/quotes");
  const [t, ts] = await Promise.all([getTranslations("account.quotes"), getTranslations("admin.quotes")]);
  if (auth.channel !== "B2B") return <Alert tone="amber">{t("b2bOnly")}</Alert>;
  const data = await listQuotes({ customerId: auth.customer!.id, page: 1 });
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />
      {data.items.length === 0 ? (
        <EmptyState>{t("none")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{ts("number")}</Th>
              <Th>{ts("validUntil")}</Th>
              <Th>{ts("totalGross")}</Th>
              <Th>{ts("statusLabel")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.items.map((q) => (
              <tr key={q.id}>
                <Td><Link href={`/account/quotes/${q.id}`} className="num text-brand-700 hover:underline">{q.number}</Link></Td>
                <Td><Num>{day(q.validUntil)}</Num></Td>
                <Td className="num">{money(q.totalGross)}</Td>
                <Td><Badge tone={q.status === "SENT" ? "amber" : q.status === "ACCEPTED" ? "green" : "neutral"}>{ts(`status.${q.status}`)}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <QuoteRequestForm />
    </div>
  );
}
