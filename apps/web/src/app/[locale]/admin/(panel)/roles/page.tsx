import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { RoleEditor } from "@/components/admin/RoleEditor";
import { PageHeader } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listRoles } from "@/server/services/staff";

export default async function RolesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await staffPagePermission(locale, "user.manage"))) return <Forbidden />;
  const [t, roles] = await Promise.all([getTranslations("admin.roles"), listRoles()]);
  return (
    <div>
      <PageHeader title={t("title")} />
      <RoleEditor
        locale={locale}
        roles={roles.map((r) => ({ id: r.id, key: r.key, nameAr: r.nameAr, nameEn: r.nameEn, isSystem: r.isSystem, permissions: r.permissions, users: r._count.users }))}
      />
    </div>
  );
}
