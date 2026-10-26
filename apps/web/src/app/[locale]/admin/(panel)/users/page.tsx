import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { StaffManager } from "@/components/admin/StaffManager";
import { PageHeader } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listRoles, listStaff } from "@/server/services/staff";

export default async function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "user.manage");
  if (!auth) return <Forbidden />;
  const [t, staff, roles] = await Promise.all([getTranslations("admin.users"), listStaff(), listRoles()]);
  return (
    <div>
      <PageHeader title={t("title")} />
      <StaffManager
        currentUserId={auth.user.id}
        roles={roles.map((r) => ({ id: r.id, name: locale === "ar" ? r.nameAr : r.nameEn }))}
        staff={staff.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          email: s.email,
          isActive: s.isActive,
          lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
          roleIds: s.roles.map((r) => r.role.id),
        }))}
      />
    </div>
  );
}
