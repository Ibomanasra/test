import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge, EmptyState, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { dateTimeText, money } from "@/server/format";
import { listOrders } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export default async function MyOrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireCustomerPage(locale, "/account/orders");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [t, tAll, data] = await Promise.all([getTranslations("account.orders"), getTranslations(), listOrders({ customerId: auth.customer!.id, page })]);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />
      {data.items.length === 0 ? (
        <EmptyState>{t("none")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("number")}</Th>
              <Th>{t("date")}</Th>
              <Th>{t("status")}</Th>
              <Th>{t("total")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.items.map((o) => (
              <tr key={o.id} data-testid="my-order-row">
                <Td><Link href={`/account/orders/${o.id}`} className="num font-medium text-brand-700 hover:underline">{o.number}</Link></Td>
                <Td><Num>{dateTimeText(o.placedAt)}</Num></Td>
                <Td><Badge tone={o.status === "DELIVERED" ? "green" : o.status === "CANCELLED" ? "red" : "brand"}>{tAll(`orderStatus.${o.status}`)}</Badge></Td>
                <Td className="num">{money(o.totalGross)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
