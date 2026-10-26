"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api-client";

export function LogoutButton({ className, redirectTo = "/" }: { className?: string; redirectTo?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <button
      type="button"
      className={className ?? "text-sm text-ink-600 hover:text-ink-900"}
      onClick={async () => {
        await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
        router.replace(redirectTo);
        router.refresh();
      }}
    >
      {t("logout")}
    </button>
  );
}
