"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert, Button } from "@/components/ui";
import { useApi } from "@/lib/api-client";

/** „Jetzt bezahlen“: Zahlung starten und zur gehosteten Bezahlseite weiterleiten */
export function PayNowButton({ orderId, label }: { orderId: string; label?: string }) {
  const t = useTranslations("pay");
  const locale = useLocale();
  const { call, pending, error } = useApi();
  async function pay() {
    const res = await call<{ redirectUrl: string }>(`/api/v1/orders/${orderId}/pay`, { body: {}, locale });
    if (res) window.location.assign(res.redirectUrl);
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <Button onClick={() => void pay()} disabled={pending} data-testid="pay-now">{label ?? t("payNow")}</Button>
      {error ? <Alert tone="red">{error}</Alert> : null}
    </span>
  );
}

/** Testseite des Fake-Gateways */
export function FakeGatewayButtons({ intentId, returnUrl }: { intentId: string; returnUrl: string }) {
  const t = useTranslations("pay");
  const locale = useLocale();
  const { call, pending, error } = useApi();
  async function go(approved: boolean) {
    if (await call(`/api/v1/payments/fake/${intentId}`, { body: { approved }, locale })) window.location.assign(returnUrl);
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void go(true)} disabled={pending} data-testid="fake-approve">{t("approve")}</Button>
        <Button className="flex-1" variant="danger" onClick={() => void go(false)} disabled={pending} data-testid="fake-decline">{t("decline")}</Button>
      </div>
      {error ? <Alert tone="red">{error}</Alert> : null}
    </div>
  );
}
