import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { day } from "@/server/format";
import { customerDocuments } from "@/server/services/customer-documents";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireCustomerPage(locale, "/account/documents");
  const [t, docs] = await Promise.all([getTranslations("account.documents"), customerDocuments(auth.customer!.id)]);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />
      {docs.length === 0 ? (
        <EmptyState>{t("none")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("date")}</Th>
              <Th>{t("type")}</Th>
              <Th>{t("number")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {docs.map((d) => (
              <tr key={`${d.kind}-${d.id}`} data-testid="doc-row">
                <Td><Num>{day(d.date)}</Num></Td>
                <Td>{t(`kinds.${d.kind}`)}</Td>
                <Td className="num">{d.number}</Td>
                <Td>
                  <a href={d.href} target="_blank" rel="noopener" className="text-brand-700 underline">{t("pdf")}</a>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
