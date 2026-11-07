"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { Button, cn } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

/** Schalter „im Shop sichtbar“ – ein Klick */
export function ActiveSwitch({ productId, active, label }: { productId: string; active: boolean; label?: boolean }) {
  const t = useTranslations("admin.products.manage");
  const router = useRouter();
  const { call, pending } = useApi();
  const [on, setOn] = useState(active);
  async function toggle() {
    const next = !on;
    setOn(next);
    if (await call(`/api/v1/admin/products/${productId}`, { method: "PATCH", body: { active: next } })) router.refresh();
    else setOn(!next);
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={() => void toggle()}
      className="inline-flex items-center gap-2 text-sm"
      data-testid="active-switch"
      title={on ? t("visible") : t("hidden")}
    >
      <span className={cn("relative h-6 w-11 rounded-full transition", on ? "bg-green-600" : "bg-ink-300")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "end-0.5" : "start-0.5")} />
      </span>
      {label ? <span className={on ? "text-green-700" : "text-ink-500"}>{on ? t("visible") : t("hidden")}</span> : null}
    </button>
  );
}

/** Löschen mit Rückfrage; bereits verkaufte Produkte werden archiviert */
export function DeleteProductButton({ productId, name, after }: { productId: string; name: string; after?: "list" | "refresh" }) {
  const t = useTranslations("admin.products.manage");
  const router = useRouter();
  const { call, pending, error } = useApi();
  async function remove() {
    if (!window.confirm(t("deleteConfirm", { name }))) return;
    const res = await call<{ mode: "deleted" | "archived" }>(`/api/v1/admin/products/${productId}`, { method: "DELETE" });
    if (!res) return;
    if (res.mode === "archived") window.alert(t("archivedInfo"));
    if (after === "list") router.push("/admin/products");
    else router.refresh();
  }
  return (
    <>
      <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" disabled={pending} onClick={() => void remove()} data-testid="delete-product" aria-label={t("delete")}>
        <Icon name="alert" className="size-4" />
        <span className="hidden sm:inline">{t("delete")}</span>
      </Button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </>
  );
}
