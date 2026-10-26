import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Forbidden } from "@/components/admin/Forbidden";
import { QuoteActions } from "@/components/admin/QuoteActions";
import { Alert, Badge, Card, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText, day, money } from "@/server/format";
import { getQuote } from "@/server/services/quotes";

export default async function QuoteDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "quote.view");
  if (!auth) return <Forbidden />;
  const q = await getQuote(id).catch(() => notFound());
  const [t, tc] = await Promise.all([getTranslations("admin.quotes"), getTranslations("common")]);
  const nm = (o: { nameAr: string | null; nameEn: string | null }) => (locale === "ar" ? o.nameAr : o.nameEn);
  return (
    <div className="space-y-6">
      <PageHeader title={<Num>{q.number}</Num>} subtitle={q.customer.displayName} actions={<Badge tone="brand">{t(`status.${q.status}`)}</Badge>} />
      {hasPermission(auth.permissions, "quote.edit") ? <QuoteActions id={q.id} status={q.status} /> : null}
      {q.requestNote ? <Alert tone="amber"><strong>{t("requestNote")}:</strong> {q.requestNote}</Alert> : null}
      <Card>
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-ink-500">{t("validUntil")}</dt><dd><Num>{day(q.validUntil)}</Num></dd></div>
          <div><dt className="text-ink-500">{t("isFixed")}</dt><dd>{q.isFixed ? tc("yes") : tc("no")}</dd></div>
          <div><dt className="text-ink-500">{t("sentAt")}</dt><dd><Num>{dateTimeText(q.sentAt)}</Num></dd></div>
          <div><dt className="text-ink-500">{t("acceptedAt")}</dt><dd><Num>{dateTimeText(q.acceptedAt)}</Num></dd></div>
        </dl>
      </Card>
      <Table>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>{tc("name")}</Th>
            <Th>{t("qty")}</Th>
            <Th>{t("unitPriceNet")}</Th>
            <Th>{t("lineNet")}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {q.items.map((i) => (
            <tr key={i.id}>
              <Td className="num">{i.variant.sku}</Td>
              <Td>{[nm(i.variant.product), nm(i.variant)].filter(Boolean).join(" – ")}</Td>
              <Td className="num">{i.qty} × {i.unitCode} ({i.unitFactor})</Td>
              <Td className="num">{money(i.unitPriceNet)}</Td>
              <Td className="num">{money(i.unitPriceNet * i.qty * i.unitFactor)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card>
        <div className="ms-auto max-w-xs space-y-1 text-sm">
          <p className="flex justify-between"><span>{t("subtotalNet")}</span><span className="num">{money(q.subtotalNet)}</span></p>
          <p className="flex justify-between"><span>{t("vat")}</span><span className="num">{money(q.vatTotal)}</span></p>
          <p className="flex justify-between font-semibold"><span>{t("totalGross")}</span><span className="num">{money(q.totalGross)}</span></p>
        </div>
      </Card>
      {q.internalNote ? <p className="text-sm text-ink-600">{t("internalNote")}: {q.internalNote}</p> : null}
    </div>
  );
}
