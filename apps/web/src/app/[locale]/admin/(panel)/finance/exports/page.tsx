import { businessDate } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";

export default async function ExportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "finance.export"))) return <Forbidden />;
  const t = await getTranslations("admin.finance");
  const today = businessDate(new Date());
  return (
    <Card title={t("exportTitle")}>
      <p className="mb-4 text-sm text-ink-600">{t("exportHint")}</p>
      {/* GET-Formular → Datei-Download */}
      <form method="get" action="/api/v1/admin/exports" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("exportKind")} htmlFor="ex-kind">
          <Select id="ex-kind" name="kind" defaultValue="invoices">
            {["invoices", "credit-notes", "payments", "ledger"].map((k) => <option key={k} value={k}>{t(`exportKinds.${k}`)}</option>)}
          </Select>
        </Field>
        <Field label={t("from")} htmlFor="ex-from"><Input id="ex-from" name="from" type="date" dir="ltr" className="num" defaultValue={`${today.slice(0, 7)}-01`} required /></Field>
        <Field label={t("to")} htmlFor="ex-to"><Input id="ex-to" name="to" type="date" dir="ltr" className="num" defaultValue={today} required /></Field>
        <Field label={t("format")} htmlFor="ex-format">
          <Select id="ex-format" name="format" defaultValue="xlsx"><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV</option></Select>
        </Field>
        <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" data-testid="export-submit">{t("download")}</Button></div>
      </form>
    </Card>
  );
}
