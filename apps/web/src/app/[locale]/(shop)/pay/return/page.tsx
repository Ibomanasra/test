import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PayNowButton } from "@/components/shop/PaymentButtons";
import { Alert, Card, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { getAuth } from "@/server/auth/context";
import { money } from "@/server/format";
import { intentForViewer, refreshIntent } from "@/server/services/card-payments";

export const dynamic = "force-dynamic";

/** Rückkehr von der Bezahlseite: Status beim Gateway prüfen und anzeigen */
export default async function PayReturnPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ intent?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { intent: id } = await searchParams;
  if (!id) notFound();
  const ctx = await getAuth();
  await intentForViewer(ctx, id).catch(() => notFound());
  const status = await refreshIntent(id);
  const intent = await intentForViewer(ctx, id);
  const t = await getTranslations("pay");
  const ok = status === "CAPTURED";
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title={ok ? t("successTitle") : status === "FAILED" || status === "CANCELLED" ? t("failedTitle") : t("pendingTitle")} />
      <Card>
        <p className="num text-sm text-ink-600">{intent.order.number} · {money(intent.amount)}</p>
        <div className="mt-3" data-testid="pay-result" data-status={status}>
          {ok ? <Alert tone="green">{t("successText")}</Alert> : status === "FAILED" || status === "CANCELLED" ? <Alert tone="red">{t("failedText")}</Alert> : <Alert tone="amber">{t("pendingText")}</Alert>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/account/orders/${intent.order.id}`} className="rounded-lg px-4 py-2.5 ring-1 ring-ink-300">{t("toOrder")}</Link>
          {!ok && status !== "REDIRECTED" ? <PayNowButton orderId={intent.order.id} label={t("retry")} /> : null}
        </div>
      </Card>
    </div>
  );
}
