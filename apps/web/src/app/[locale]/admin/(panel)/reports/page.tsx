import { reportQuerySchema } from "@sa/contracts";
import { businessDate, formatBps, hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { money } from "@/server/format";
import { buildReport, type ReportKind } from "@/server/services/reports";

const KINDS: ReportKind[] = ["channel", "category", "product", "customer", "zone", "period", "top", "flop", "stock-value"];

export default async function ReportsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "report.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const parsed = reportQuerySchema.safeParse({ ...sp, format: "html" });
  const q = parsed.success ? parsed.data : reportQuerySchema.parse({});
  const today = businessDate(new Date());
  const [t, tc] = await Promise.all([getTranslations("admin.reports"), getTranslations("common")]);
  const report = await buildReport(q.kind, q.from ? businessDate(q.from) : undefined, q.to ? businessDate(q.to) : undefined, locale, q.channel);
  const seeMargin = hasPermission(auth.permissions, "dashboard.view_margin") || hasPermission(auth.permissions, "price.view_cost");
  const canExport = hasPermission(auth.permissions, "report.export");
  const stock = q.kind === "stock-value";
  const qs = new URLSearchParams({ kind: q.kind, from: report.from, to: report.to, lang: locale, ...(q.channel ? { channel: q.channel } : {}) });
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />
      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label={t("kind")} htmlFor="r-kind">
            <Select id="r-kind" name="kind" defaultValue={q.kind}>{KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}</Select>
          </Field>
          <Field label={t("from")} htmlFor="r-from"><Input id="r-from" name="from" type="date" dir="ltr" className="num" defaultValue={report.from} max={today} /></Field>
          <Field label={t("to")} htmlFor="r-to"><Input id="r-to" name="to" type="date" dir="ltr" className="num" defaultValue={report.to} /></Field>
          <Field label={t("channel")} htmlFor="r-ch">
            <Select id="r-ch" name="channel" defaultValue={q.channel ?? ""}><option value="">{tc("all")}</option><option value="B2C">B2C</option><option value="B2B">B2B</option></Select>
          </Field>
          <div className="flex items-end"><Button type="submit" data-testid="report-show">{t("show")}</Button></div>
        </form>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{t(`kinds.${q.kind}`)}</h2>
        {!stock ? <span className="num text-sm text-ink-600">{report.from} → {report.to}</span> : null}
        <span className="ms-auto flex flex-wrap gap-2">
          <a href={`/api/v1/admin/reports?${qs}&format=pdf`} target="_blank" rel="noopener" className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-ink-300" data-testid="report-pdf">🖨 {t("pdf")}</a>
          {canExport ? <a href={`/api/v1/admin/reports?${qs}&format=xlsx`} className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-ink-300" data-testid="report-xlsx">Excel</a> : null}
          {canExport ? <a href={`/api/v1/admin/reports?${qs}&format=csv`} className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-ink-300">CSV</a> : null}
        </span>
      </div>
      {report.rows.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("item")}</Th>
              <Th>{t("qty")}</Th>
              <Th>{stock ? t("stockValue") : t("net")}</Th>
              {!stock && seeMargin ? <><Th>{t("margin")}</Th><Th>%</Th></> : null}
              <Th>{t("share")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {report.rows.map((r) => (
              <tr key={r.key} data-testid="report-row">
                <Td>{r.label}</Td>
                <Td className="num">{r.qty}</Td>
                <Td className="num font-medium">{money(r.net)}</Td>
                {!stock && seeMargin ? <><Td className={`num ${r.margin < 0 ? "text-red-700" : ""}`}>{money(r.margin)}</Td><Td className="num">{formatBps(r.marginBps)}</Td></> : null}
                <Td className="num">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 rounded bg-brand-500" style={{ width: `${Math.max(2, r.share / 100)}px` }} aria-hidden="true" />
                    {formatBps(r.share)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <Td>{t("total")}</Td>
              <Td className="num">{report.total.qty}</Td>
              <Td className="num" data-testid="report-total">{money(report.total.net)}</Td>
              {!stock && seeMargin ? <><Td className="num">{money(report.total.margin)}</Td><Td className="num">{formatBps(report.total.marginBps)}</Td></> : null}
              <Td />
            </tr>
          </tfoot>
        </Table>
      )}
    </div>
  );
}
