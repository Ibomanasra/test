import { customerListQuerySchema } from "@sa/contracts";
import { formatPhone } from "@sa/core";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { Pagination } from "@/components/admin/Pagination";
import { PrintTableButton } from "@/components/print/PrintTableButton";
import { Badge, Button, EmptyState, Input, Num, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listCustomers } from "@/server/services/customers";

import { CUSTOMER_STATUS_TONE as STATUS_TONE } from "@/components/admin/status";

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "customer.view"))) return <Forbidden />;
  const parsed = customerListQuerySchema.safeParse(await searchParams);
  const filter = parsed.success ? parsed.data : { page: 1 };
  const [{ items, total, pageSize }, t, tc, tAll, format] = await Promise.all([
    listCustomers(filter),
    getTranslations("admin.customers"),
    getTranslations("common"),
    getTranslations(),
    getFormatter(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={<Num>{total}</Num>}
        actions={
          <PrintTableButton
            data={{
              title: t("title"),
              columns: [
                { key: "number", label: tc("number") },
                { key: "name", label: tc("name") },
                { key: "type", label: tc("type") },
                { key: "status", label: tc("status") },
                { key: "group", label: t("group") },
                { key: "phone", label: tc("phone"), kind: "num" },
              ],
              rows: items.map((c) => ({
                number: c.number,
                name: c.displayName,
                type: tAll(`channel.${c.type}`),
                status: tAll(`customerStatus.${c.status}`),
                group: c.group ? (locale === "ar" ? c.group.nameAr : c.group.nameEn) : "",
                phone: c.phone ? formatPhone(c.phone) : "",
              })),
            }}
          />
        }
      />
      <form className="flex flex-wrap gap-2" method="get">
        <Input name="q" defaultValue={filter.q} placeholder={t("searchPlaceholder")} className="max-w-xs" />
        <Select name="type" defaultValue={filter.type ?? ""} className="w-auto">
          <option value="">{tc("type")}: {tc("all")}</option>
          <option value="B2C">{tAll("customerType.B2C")}</option>
          <option value="B2B">{tAll("customerType.B2B")}</option>
        </Select>
        <Select name="status" defaultValue={filter.status ?? ""} className="w-auto">
          <option value="">{tc("status")}: {tc("all")}</option>
          {(["ACTIVE", "PENDING_APPROVAL", "REJECTED", "BLOCKED"] as const).map((s) => (
            <option key={s} value={s}>{tAll(`customerStatus.${s}`)}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">{tc("filter")}</Button>
      </form>

      {items.length === 0 ? (
        <EmptyState>{tc("noResults")}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{tc("number")}</Th>
              <Th>{tc("name")}</Th>
              <Th>{tc("type")}</Th>
              <Th>{tc("status")}</Th>
              <Th>{t("group")}</Th>
              <Th>{tc("phone")}</Th>
              <Th>{tc("createdAt")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-ink-50" data-testid="customer-row">
                <Td><Link href={`/admin/customers/${c.id}`} className="num font-medium text-brand-700 hover:underline">{c.number}</Link></Td>
                <Td>
                  <Link href={`/admin/customers/${c.id}`} className="hover:underline">{c.displayName}</Link>
                  {c.isDemo ? <span className="ms-2"><Badge>{tc("demoBadge")}</Badge></span> : null}
                </Td>
                <Td>{tAll(`channel.${c.type}`)}</Td>
                <Td><Badge tone={STATUS_TONE[c.status]}>{tAll(`customerStatus.${c.status}`)}</Badge></Td>
                <Td>{c.group ? (locale === "ar" ? c.group.nameAr : c.group.nameEn) : "–"}</Td>
                <Td><Num>{c.phone ? formatPhone(c.phone) : "–"}</Num></Td>
                <Td><Num>{format.dateTime(c.createdAt, "short")}</Num></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={filter.page} total={total} pageSize={pageSize} />
    </div>
  );
}
