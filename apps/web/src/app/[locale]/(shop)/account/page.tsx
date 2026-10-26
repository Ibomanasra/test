import { formatPhone } from "@sa/core";
import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LogoutButton } from "@/components/LogoutButton";
import { Alert, Badge, Card, Money, Num, PageHeader } from "@/components/ui";
import { requireCustomerPage } from "@/server/auth/page-guards";

export const dynamic = "force-dynamic";

import { CUSTOMER_STATUS_TONE as STATUS_TONE } from "@/components/admin/status";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireCustomerPage(locale, "/account");
  const [t, tc, tAll] = await Promise.all([getTranslations("account"), getTranslations("common"), getTranslations()]);
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: auth.customer!.id },
    select: {
      number: true,
      type: true,
      status: true,
      displayName: true,
      companyName: true,
      dealerNumber: true,
      paymentTermDays: true,
      creditLimitAgorot: true,
      allowOnAccount: true,
      addresses: { include: { zone: { select: { nameAr: true, nameEn: true } } }, orderBy: { isDefault: "desc" } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={auth.user.name} actions={<LogoutButton className="rounded-lg px-3 py-2 text-sm ring-1 ring-ink-300 hover:bg-ink-100" />} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-ink-500">{t("customerNumber")}</dt>
            <dd><Num>{customer.number}</Num></dd>
            <dt className="text-ink-500">{tc("phone")}</dt>
            <dd><Num>{formatPhone(auth.user.phone)}</Num></dd>
            <dt className="text-ink-500">{t("accountType")}</dt>
            <dd>{tAll(`customerType.${customer.type}`)}</dd>
            <dt className="text-ink-500">{tc("status")}</dt>
            <dd data-testid="customer-status"><Badge tone={STATUS_TONE[customer.status]}>{tAll(`customerStatus.${customer.status}`)}</Badge></dd>
            <dt className="text-ink-500">{t("priceChannel")}</dt>
            <dd data-testid="price-channel">{tAll(`channel.${auth.channel}`)}</dd>
            {customer.type === "B2B" ? (
              <>
                <dt className="text-ink-500">{t("company")}</dt>
                <dd>{customer.companyName}</dd>
                <dt className="text-ink-500">{tAll("register.dealerNumber")}</dt>
                <dd><Num>{customer.dealerNumber}</Num></dd>
              </>
            ) : null}
            {customer.type === "B2B" && customer.status === "ACTIVE" ? (
              <>
                <dt className="text-ink-500">{t("paymentTerms")}</dt>
                <dd>{t("days", { days: customer.paymentTermDays ?? 0 })}</dd>
                <dt className="text-ink-500">{t("creditLimit")}</dt>
                <dd><Money agorot={customer.creditLimitAgorot} /></dd>
              </>
            ) : null}
          </dl>
        </Card>
        <Card title={t("addresses")}>
          <ul className="space-y-3 text-sm">
            {customer.addresses.map((a) => (
              <li key={a.id} className="rounded-lg bg-ink-50 p-3">
                <div className="flex items-center gap-2 font-medium">
                  {locale === "ar" ? a.zone.nameAr : a.zone.nameEn} – {a.city}
                  {a.isDefault ? <Badge tone="brand">{t("default")}</Badge> : null}
                </div>
                <div className="text-ink-600">{[a.street, a.details].filter(Boolean).join("، ")}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {/* TODO(Phase 3–5): Bestellungen, Kontoauszug, offene Posten, Dokumente */}
      <Alert tone="blue">{t("ordersComing")}</Alert>
    </div>
  );
}
