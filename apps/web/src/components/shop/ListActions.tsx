"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export function ListActions({ id }: { id: string }) {
  const t = useTranslations("account.lists");
  const tc = useTranslations("common");
  const router = useRouter();
  const { call, pending } = useApi();
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={async () => { if (await call(`/api/v1/lists/${id}/to-cart`, { body: {} })) router.push("/cart"); }}>{t("toCart")}</Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={async () => { if (window.confirm(tc("confirmDelete")) && (await call(`/api/v1/lists/${id}`, { method: "DELETE" }))) router.refresh(); }}>{tc("delete")}</Button>
    </div>
  );
}
