import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AccountQuoteActions } from "@/components/shop/AccountQuoteActions";
import { PrintButton } from "@/components/print/PrintButton";
import { CartActionButton } from "@/components/shop/ReorderButton";
import { Alert, Badge, Card, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { day, money } from "@/server/format";
import { getQuote } from "@/server/services/quotes";

export const dynamic = "force-dynamic";

export default async function AccountQuotePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await requireCustomerPage(locale, `/account/quotes/${id}`);
  if (auth.channel !== "B2B") notFound();
  const q = await getQuote(id, auth.customer!.id).catch(() => notFound());
  const [t, ts, tc, tAll] = await Promise.all([getTranslations("account.quotes"), getTranslations("admin.quotes"), getTranslations("common"), getTranslations()]);
  const nm = (o: { nameAr: string | null; nameEn: string | null }) => (locale === "ar" ? o.nameAr : o.nameEn);
  return (
    <div className="space-y-6">
      <PageHeader title={<Num>{q.number}</Num>} subtitle={`${ts("validUntil")}: ${day(q.validUntil)}`} actions={<div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{ts(`status.${q.status}`)}</Badge><PrintButton href={`/api/v1/documents/quote/${q.id}`} testId="print-quote" /></div>} />
      {q.status === "SENT" ? <AccountQuoteActions id={q.id} /> : null}
      {q.status === "ACCEPTED" ? (
        <Alert tone="green">
          {t("acceptedNote")}{" "}
          <CartActionButton endpoint="/api/v1/cart/quote" body={{ quoteId: q.id }} label={t("toCart")} variant="primary" testId="quote-to-cart" />
        </Alert>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>{tc("name")}</Th>
            <Th>{ts("qty")}</Th>
            <Th>{ts("unitPriceNet")}</Th>
            <Th>{ts("lineNet")}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {q.items.map((i) => (
            <tr key={i.id}>
              <Td className="num">{i.variant.sku}</Td>
              <Td>{[nm(i.variant.product), nm(i.variant)].filter(Boolean).join(" – ")}</Td>
              <Td className="num">{i.qty} × {tAll(`units.${i.unitCode}`)}</Td>
              <Td className="num">{money(i.unitPriceNet)}</Td>
              <Td className="num">{money(i.unitPriceNet * i.qty * i.unitFactor)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card>
        <div className="ms-auto max-w-xs space-y-1 text-sm">
          <p className="flex justify-between"><span>{ts("subtotalNet")}</span><span className="num">{money(q.subtotalNet)}</span></p>
          <p className="flex justify-between"><span>{ts("vat")}</span><span className="num">{money(q.vatTotal)}</span></p>
          <p className="flex justify-between font-semibold"><span>{ts("totalGross")}</span><span className="num">{money(q.totalGross)}</span></p>
        </div>
      </Card>
    </div>
  );
}
