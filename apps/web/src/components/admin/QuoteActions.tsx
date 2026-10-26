"use client";

import { useTranslations } from "next-intl";
import { Alert, Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export function QuoteActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("admin.quotes");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const act = async (path: string) => {
    if (await call(`/api/v1/admin/quotes/${id}/${path}`, { method: "POST", body: {} })) router.refresh();
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" ? <Button onClick={() => void act("send")} disabled={pending} data-testid="quote-send">{t("send")}</Button> : null}
        {["DRAFT", "REQUESTED"].includes(status) ? (
          <Button variant="secondary" onClick={() => router.push(`/admin/quotes/${id}/edit`)}>{t("edit")}</Button>
        ) : null}
        {!["CONVERTED", "REJECTED", "EXPIRED"].includes(status) ? (
          <Button variant="danger" onClick={() => void act("cancel")} disabled={pending}>{t("cancelQuote")}</Button>
        ) : null}
      </div>
      {error ? <Alert tone="red">{error}</Alert> : null}
    </div>
  );
}
