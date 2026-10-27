import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FakeGatewayButtons } from "@/components/shop/PaymentButtons";
import { Alert, Card, PageHeader } from "@/components/ui";
import { env } from "@/server/env";
import { getAuth } from "@/server/auth/context";
import { money } from "@/server/format";
import { intentForViewer } from "@/server/services/card-payments";

export const dynamic = "force-dynamic";

/** Simulierte Bezahlseite (nur PAYMENT_GATEWAY=fake, nicht in Produktion) */
export default async function FakePayPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (env().PAYMENT_GATEWAY !== "fake" || env().NODE_ENV === "production") notFound();
  const intent = await intentForViewer(await getAuth(), id).catch(() => notFound());
  const t = await getTranslations("pay");
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title={t("fakeTitle")} />
      <Alert tone="amber">{t("fakeHint")}</Alert>
      <Card>
        <p className="text-sm text-ink-600">{intent.order.number}</p>
        <p className="num text-2xl font-bold">{money(intent.amount)}</p>
        <div className="mt-4"><FakeGatewayButtons intentId={intent.id} returnUrl={`/${locale}/pay/return?intent=${intent.id}`} /></div>
      </Card>
    </div>
  );
}
