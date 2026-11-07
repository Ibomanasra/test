import { hasAnyPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { MobileMenu } from "@/components/admin/MobileMenu";
import { ADMIN_NAV } from "@/components/admin/nav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoutButton } from "@/components/LogoutButton";
import { PushToggle } from "@/components/notifications/PushToggle";
import { Link } from "@/i18n/navigation";
import { requireStaffPage } from "@/server/auth/page-guards";
import { ownDriversEnabled } from "@/server/services/delivery-mode";

export const dynamic = "force-dynamic";

export const metadata = { manifest: "/api/v1/manifest/admin" };

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireStaffPage(locale);
  const t = await getTranslations("admin");
  const ownDrivers = await ownDriversEnabled();
  // „Lieferung & Fahrer“ nur, wenn eigene Fahrer eingeschaltet sind (sonst externe Zustellfirmen)
  const items = ADMIN_NAV.filter((i) => hasAnyPermission(auth.permissions, i.anyOf) && (i.key !== "delivery" || ownDrivers));

  const sidebar = (
    <>
      <div className="mb-6 px-3">
        <Logo tone="dark" size={64} subtitle={t("title")} />
      </div>
      <AdminSidebar items={items} />
    </>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-64 shrink-0 bg-ink-900 p-4 lg:block">{sidebar}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-ink-200 bg-white px-4 py-3">
          <MobileMenu label={t("nav.menu")} closeLabel={(await getTranslations("common"))("close")}>{sidebar}</MobileMenu>
          <p className="text-sm text-ink-600" data-testid="admin-user">{t("loggedInAs", { name: auth.user.name })}</p>
          <div className="ms-auto flex items-center gap-2">
            <PushToggle compact />
            <Link href="/" className="text-sm text-ink-600 hover:text-ink-900">{t("nav.toShop")}</Link>
            <Suspense>
              <LanguageSwitcher />
            </Suspense>
            <LogoutButton redirectTo="/admin/login" className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-ink-300 hover:bg-ink-100" />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
