import { formatPhone, hasPermission } from "@sa/core";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CustomerActions } from "@/components/admin/CustomerActions";
import { Forbidden } from "@/components/admin/Forbidden";
import { CUSTOMER_STATUS_TONE } from "@/components/admin/status";
import { PrintButton } from "@/components/print/PrintButton";
import { Alert, Badge, Card, Money, DateText, Num, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { AppError } from "@/server/errors";
import { customerDocuments } from "@/server/services/customer-documents";
import { customerFinance, getCustomerDetail } from "@/server/services/customers";
import { day, money } from "@/server/format";
import { getCompanySettings, listCustomerGroups } from "@/server/services/settings";

export default async function CustomerDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "customer.view");
  if (!auth) return <Forbidden />;
  const c = await getCustomerDetail(id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  const [t, tc, tAll, format, groups, company] = await Promise.all([
    getTranslations("admin.customers"),
    getTranslations("common"),
    getTranslations(),
    getFormatter(),
    listCustomerGroups(),
    getCompanySettings(),
  ]);
  const name = (o: { nameAr: string; nameEn: string }) => (locale === "ar" ? o.nameAr : o.nameEn);

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.displayName}
        subtitle={<Num>{c.number}</Num>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={CUSTOMER_STATUS_TONE[c.status]}>{tAll(`customerStatus.${c.status}`)}</Badge>
            <PrintButton href={`/api/v1/documents/statement/${c.id}`} label={tAll("admin.documents.statement")} testId="print-statement" />
            {c.type === "B2B" ? <PrintButton href={`/api/v1/documents/price-list/customer:${c.id}`} label={tAll("admin.documents.priceList")} testId="print-price-list" /> : null}
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={tc("details")}>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-ink-500">{tc("type")}</dt>
              <dd>{tAll(`customerType.${c.type}`)}</dd>
              {c.type === "B2B" ? (
                <>
                  <dt className="text-ink-500">{t("owner")}</dt>
                  <dd>{c.ownerName}</dd>
                  <dt className="text-ink-500">{t("dealerNumber")}</dt>
                  <dd><Num>{c.dealerNumber}</Num></dd>
                  <dt className="text-ink-500">{t("group")}</dt>
                  <dd>{c.group ? name(c.group) : "–"}</dd>
                  <dt className="text-ink-500">{t("paymentTermDays")}</dt>
                  <dd><Num>{c.paymentTermDays ?? "–"}</Num></dd>
                  <dt className="text-ink-500">{t("creditLimit")}</dt>
                  <dd><Money agorot={c.creditLimitAgorot} /></dd>
                  <dt className="text-ink-500">{t("allowOnAccount")}</dt>
                  <dd>{c.allowOnAccount ? tc("yes") : tc("no")}</dd>
                  <dt className="text-ink-500">{t("license")}</dt>
                  <dd>
                    {c.licenseFile ? (
                      <a href={`/api/v1/files/${c.licenseFile.id}`} target="_blank" rel="noopener" className="text-brand-700 underline" data-testid="license-link">
                        {t("openLicense")}
                      </a>
                    ) : "–"}
                  </dd>
                </>
              ) : null}
              <dt className="text-ink-500">{tc("phone")}</dt>
              <dd><Num>{c.phone ? formatPhone(c.phone) : "–"}</Num></dd>
              <dt className="text-ink-500">{tc("email")}</dt>
              <dd className="num">{c.email ?? "–"}</dd>
              <dt className="text-ink-500">{tc("createdAt")}</dt>
              <dd><DateText>{format.dateTime(c.createdAt, "long")}</DateText></dd>
              {c.approvedAt ? (
                <>
                  <dt className="text-ink-500">{t("approvedAt")}</dt>
                  <dd><DateText>{format.dateTime(c.approvedAt, "long")}</DateText></dd>
                </>
              ) : null}
              {c.rejectedReason ? (
                <>
                  <dt className="text-ink-500">{t("rejectedReason")}</dt>
                  <dd>{c.rejectedReason}</dd>
                </>
              ) : null}
              {c.blockedReason ? (
                <>
                  <dt className="text-ink-500">{t("blockedReason")}</dt>
                  <dd>{c.blockedReason}</dd>
                </>
              ) : null}
            </dl>
          </Card>

          <Card title={t("members")}>
            <ul className="divide-y divide-ink-100 text-sm">
              {c.members.map((m) => (
                <li key={m.userId} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{m.user.name} <Badge>{m.role}</Badge></span>
                  <span className="text-ink-500">
                    <Num>{formatPhone(m.user.phone)}</Num> · {t("lastLogin")}: <Num>{m.user.lastLoginAt ? format.dateTime(m.user.lastLoginAt, "short") : "–"}</Num>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={(await getTranslations("account"))("addresses")}>
            <ul className="space-y-2 text-sm">
              {c.addresses.map((a) => (
                <li key={a.id} className="rounded-lg bg-ink-50 p-3">
                  <span className="font-medium">{name(a.zone)} – {a.city}</span> · {[a.street, a.details].filter(Boolean).join("، ")} · <Num>{formatPhone(a.phone)}</Num>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={tc("notes")}>
            {c.notes.length === 0 ? <p className="text-sm text-ink-500">{tc("none")}</p> : null}
            <ul className="space-y-3 text-sm">
              {c.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-ink-50 p-3">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-500">{n.author.name} · <DateText>{format.dateTime(n.createdAt, "long")}</DateText></p>
                </li>
              ))}
            </ul>
          </Card>
          {/* TODO(Phase 4/5): Umsatz, Kontoauszug, offene Posten, Dokumente */}
          <Alert tone="blue">{t("statementComing")}</Alert>
        </div>

        <div>
          <CustomerActions
            customerId={c.id}
            type={c.type}
            status={c.status}
            groups={groups.map((g) => ({ id: g.id, name: name(g), defaultPaymentTermDays: g.defaultPaymentTermDays, defaultCreditLimitAgorot: g.defaultCreditLimitAgorot }))}
            current={{ groupId: c.groupId, paymentTermDays: c.paymentTermDays, creditLimitAgorot: c.creditLimitAgorot, allowOnAccount: c.allowOnAccount }}
            defaultPaymentTermDays={company.defaultPaymentTermDays}
            can={{
              approve: hasPermission(auth.permissions, "customer.approve"),
              credit: hasPermission(auth.permissions, "customer.credit"),
              block: hasPermission(auth.permissions, "customer.block"),
              note: hasPermission(auth.permissions, "customer.edit"),
            }}
          />
          {hasPermission(auth.permissions, "finance.view") ? await (async () => {
            const [fin, docs, tf] = await Promise.all([customerFinance(c.id), customerDocuments(c.id), getTranslations("admin.customerFinance")]);
            return (
              <div className="mt-6 space-y-4" data-testid="customer-finance">
                <Card title={tf("title")}>
                  <dl className="grid gap-2 text-sm sm:grid-cols-3">
                    <div><dt className="text-ink-500">{tf("revenueYtd")}</dt><dd className="num font-semibold">{money(fin.revenueYtd)}</dd></div>
                    <div><dt className="text-ink-500">{tf("open")}</dt><dd className="num font-semibold">{money(fin.openTotal)}</dd></div>
                    <div><dt className="text-ink-500">{tf("overdue")}</dt><dd className={`num font-semibold ${fin.overdueTotal ? "text-red-700" : ""}`}>{money(fin.overdueTotal)}</dd></div>
                  </dl>
                  {fin.openItems.length ? (
                    <ul className="mt-3 space-y-1 text-sm">
                      {fin.openItems.map((i) => (
                        <li key={i.id} className={i.overdue ? "text-red-700" : undefined}>
                          <Link href={`/admin/documents/invoices/${i.id}`} className="num underline">{i.number}</Link> · {tf("due")} <Num>{day(i.dueDate)}</Num> · <span className="num">{money(i.open)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
                <Card title={tf("orders")}>
                  <ul className="space-y-1 text-sm">
                    {fin.orders.map((o) => (
                      <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="num text-brand-700 underline">{o.number}</Link> · <Num>{day(o.placedAt)}</Num> · {tAll(`orderStatus.${o.status}`)} · <span className="num">{money(o.totalGross)}</span></li>
                    ))}
                  </ul>
                </Card>
                <Card title={tf("documents")}>
                  <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                    {docs.slice(0, 50).map((d) => (
                      <li key={`${d.kind}-${d.id}`}><a href={d.href} target="_blank" rel="noopener" className="num text-brand-700 underline">{d.number}</a> · {tf(`docKind.${d.kind}`)} · <Num>{day(d.date)}</Num></li>
                    ))}
                  </ul>
                </Card>
              </div>
            );
          })() : null}
          <p className="mt-6 text-sm"><Link href={`/admin/audit?entityType=Customer&entityId=${c.id}`} className="text-brand-700 underline">{(await getTranslations("admin.nav"))("audit")}</Link></p>
        </div>
      </div>
    </div>
  );
}
