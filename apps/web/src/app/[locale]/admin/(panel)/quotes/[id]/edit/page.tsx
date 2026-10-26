import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Forbidden } from "@/components/admin/Forbidden";
import { QuoteEditor } from "@/components/admin/QuoteEditor";
import { PageHeader } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, moneyInput } from "@/server/format";
import { quoteEditorOptions } from "@/server/services/quote-options";
import { getQuote } from "@/server/services/quotes";

export default async function EditQuotePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "quote.edit"))) return <Forbidden />;
  const q = await getQuote(id).catch(() => notFound());
  const [t, opts] = await Promise.all([getTranslations("admin.quotes"), quoteEditorOptions(locale)]);
  return (
    <div>
      <PageHeader title={`${t("edit")} · ${q.number}`} />
      <QuoteEditor
        {...opts}
        quoteId={q.id}
        customers={[{ value: q.customer.id, label: q.customer.displayName }, ...opts.customers.filter((c) => c.value !== q.customer.id)]}
        initial={{
          customerId: q.customerId,
          validUntil: day(q.validUntil),
          isFixed: q.isFixed,
          internalNote: q.internalNote ?? "",
          items: q.items.map((i) => ({ sku: i.variant.sku, unitCode: i.unitCode, qty: String(i.qty), price: moneyInput(i.unitPriceNet) })),
        }}
      />
    </div>
  );
}
