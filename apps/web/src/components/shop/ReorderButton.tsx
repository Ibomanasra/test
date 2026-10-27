"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export function CartActionButton({ endpoint, body, label, variant = "secondary", testId }: { endpoint: string; body?: unknown; label: string; variant?: "primary" | "secondary"; testId?: string }) {
  const t = useTranslations("errors");
  const router = useRouter();
  const { call, pending, error } = useApi();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant={variant} size="sm" disabled={pending} data-testid={testId} onClick={async () => { if (await call(endpoint, { body: body ?? {} })) router.push("/cart"); }}>
        {label}
      </Button>
      {error ? <span className="text-xs text-red-700">{error || t("generic")}</span> : null}
    </span>
  );
}
