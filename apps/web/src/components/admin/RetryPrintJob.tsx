"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export function RetryPrintJob({ id }: { id: string }) {
  const t = useTranslations("admin.documents");
  const router = useRouter();
  const { call, pending } = useApi();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={async () => { if (await call(`/api/v1/admin/print-jobs/${id}`, { method: "POST" })) router.refresh(); }}>
      {t("retry")}
    </Button>
  );
}
