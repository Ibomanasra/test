import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { QuoteEditor } from "@/components/admin/QuoteEditor";
import { PageHeader } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { quoteEditorOptions } from "@/server/services/quote-options";

export default async function NewQuotePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ customerId?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "quote.edit"))) return <Forbidden />;
  const [t, opts, sp] = await Promise.all([getTranslations("admin.quotes"), quoteEditorOptions(locale), searchParams]);
  return (
    <div>
      <PageHeader title={t("new")} />
      <QuoteEditor
        {...opts}
        initial={sp.customerId ? { customerId: sp.customerId, validUntil: opts.defaultValidUntil, isFixed: true, internalNote: "", items: [{ sku: "", unitCode: "CARTON", qty: "1", price: "" }] } : undefined}
      />
    </div>
  );
}
