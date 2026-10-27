import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { RetryPrintJob } from "@/components/admin/RetryPrintJob";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { dateTimeText } from "@/server/format";
import { listPrintJobs } from "@/server/services/print-jobs";

const TONE = { QUEUED: "amber", RENDERING: "blue", DONE: "green", FAILED: "red" } as const;

export default async function PrintJobsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "order.print");
  if (!auth) return <Forbidden />;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [t, tDoc, data] = await Promise.all([getTranslations("admin.documents"), getTranslations("admin.settings.docs"), listPrintJobs(page)]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">{t("printJobsText")}</p>
      {data.items.length === 0 ? (
        <EmptyState>{t("noPrintJobs")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("created")}</Th>
              <Th>{t("trigger")}</Th>
              <Th>{t("documentsLabel")}</Th>
              <Th>{t("for")}</Th>
              <Th>{t("jobStatus")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.items.map((j) => (
              <tr key={j.id} data-testid="print-job-row">
                <Td className="num">{dateTimeText(j.createdAt)}</Td>
                <Td>{t(`triggerType.${j.trigger}`)}</Td>
                <Td>{j.docTypes.map((d) => tDoc(`docType.${d}`)).join(" + ")}</Td>
                <Td className="num">{j.labels.join(", ")}</Td>
                <Td>
                  <Badge tone={TONE[j.status]}>{t(`jobStatusType.${j.status}`)}</Badge>
                  {j.error ? <span className="block text-xs text-red-700">{j.error}</span> : null}
                </Td>
                <Td>
                  {j.status === "DONE" ? (
                    <a href={`/api/v1/admin/print-jobs/${j.id}`} target="_blank" rel="noopener" className="rounded-lg px-3 py-1 text-sm ring-1 ring-ink-300 hover:bg-ink-100">🖨 {t("openPdf")}</a>
                  ) : j.status === "FAILED" ? (
                    <RetryPrintJob id={j.id} />
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}
