import { auditQuerySchema } from "@sa/contracts";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { Button, EmptyState, Input, DateText, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listAudit } from "@/server/services/audit-log";

function Json({ value }: { value: unknown }) {
  if (value == null) return <span className="text-ink-400">–</span>;
  return (
    <details>
      <summary className="cursor-pointer text-xs text-brand-700">JSON</summary>
      <pre dir="ltr" className="mt-1 max-h-64 max-w-md overflow-auto rounded bg-ink-900 p-2 text-start text-[11px] text-ink-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "audit.view"))) return <Forbidden />;
  const parsed = auditQuerySchema.safeParse(await searchParams);
  const filter = parsed.success ? parsed.data : { page: 1 };
  const [{ items, total, pageSize }, t, tc, format] = await Promise.all([
    listAudit(filter),
    getTranslations("admin.audit"),
    getTranslations("common"),
    getFormatter(),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={<Num>{total}</Num>} />
      <form method="get" className="flex flex-wrap gap-2">
        <Input name="action" placeholder={t("action")} defaultValue={filter.action} dir="ltr" className="max-w-48" />
        <Input name="entityType" placeholder={t("entity")} defaultValue={filter.entityType} dir="ltr" className="max-w-48" />
        <Input name="entityId" placeholder="ID" defaultValue={filter.entityId} dir="ltr" className="max-w-56" />
        <Button type="submit" variant="secondary">{tc("filter")}</Button>
      </form>
      {items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("time")}</Th>
              <Th>{t("actor")}</Th>
              <Th>{t("action")}</Th>
              <Th>{t("entity")}</Th>
              <Th>{t("before")}</Th>
              <Th>{t("after")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {items.map((a) => (
              <tr key={a.id} data-testid="audit-row">
                <Td><DateText>{format.dateTime(a.createdAt, "long")}</DateText></Td>
                <Td>{a.actor?.name ?? t("system")}</Td>
                <Td><span className="num text-xs">{a.action}</span></Td>
                <Td><span className="num text-xs">{a.entityType}{a.entityId ? ` · ${a.entityId.slice(0, 10)}…` : ""}</span></Td>
                <Td><Json value={a.before} /></Td>
                <Td><Json value={a.after} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={filter.page} total={total} pageSize={pageSize} />
    </div>
  );
}
