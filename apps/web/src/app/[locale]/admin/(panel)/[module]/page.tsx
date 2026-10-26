import { hasAnyPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Forbidden } from "@/components/admin/Forbidden";
import { PLANNED_MODULES } from "@/components/admin/nav";
import { Alert, Badge, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/page-guards";

/**
 * Gekennzeichneter Platzhalter für Module späterer Phasen (keine stillen Attrappen).
 * Jede Seite nennt die Phase; Details in ROADMAP.md.
 */
export default async function PlannedModulePage({ params }: { params: Promise<{ locale: string; module: string }> }) {
  const { locale, module } = await params;
  setRequestLocale(locale);
  const item = PLANNED_MODULES.get(module);
  if (!item) notFound();
  const auth = await requireStaffPage(locale);
  if (!hasAnyPermission(auth.permissions, item.anyOf)) return <Forbidden />;
  const [t, tc] = await Promise.all([getTranslations("admin"), getTranslations("common")]);
  return (
    <div className="space-y-4" data-testid="planned-module">
      <PageHeader title={t(`nav.${item.key}`)} actions={<Badge tone="amber">{tc("plannedPhase", { phase: item.plannedPhase! })}</Badge>} />
      <Alert tone="blue">{t("module.text")}</Alert>
    </div>
  );
}
