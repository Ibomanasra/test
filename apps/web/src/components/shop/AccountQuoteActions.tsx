"use client";

import { useTranslations } from "next-intl";
import { Alert, Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export function AccountQuoteActions({ id }: { id: string }) {
  const t = useTranslations("account.quotes");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const act = async (a: "accept" | "reject") => {
    if (await call(`/api/v1/quotes/${id}/${a}`, { method: "POST", body: {} })) router.refresh();
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button onClick={() => void act("accept")} disabled={pending} data-testid="quote-accept">{t("accept")}</Button>
        <Button variant="secondary" onClick={() => void act("reject")} disabled={pending}>{t("reject")}</Button>
      </div>
      {error ? <Alert tone="red">{error}</Alert> : null}
    </div>
  );
}
