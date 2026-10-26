import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { StaffLoginForm } from "@/components/auth/StaffLoginForm";
import { Card } from "@/components/ui";
import { redirect } from "@/i18n/navigation";
import { getAuth } from "@/server/auth/context";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("staffTitle") };
}

export default async function StaffLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await getAuth();
  if (auth?.isStaff) redirect({ href: "/admin", locale });
  const [t, tc] = await Promise.all([getTranslations("auth"), getTranslations("common")]);
  return (
    <main className="grid min-h-dvh place-items-center bg-ink-100 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-brand-800">{tc("appName")}</p>
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
        </div>
        <Card title={t("staffTitle")}>
          <p className="mb-4 text-sm text-ink-600">{t("staffIntro")}</p>
          <StaffLoginForm />
        </Card>
      </div>
    </main>
  );
}
