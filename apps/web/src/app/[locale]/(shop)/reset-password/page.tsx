import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordResetConfirm } from "@/components/auth/PasswordResetForms";
import { Card } from "@/components/ui";
import { redirect } from "@/i18n/navigation";

export default async function CustomerResetPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  if (!token) redirect({ href: "/forgot-password", locale });
  const t = await getTranslations("auth.reset");
  return (
    <div className="mx-auto max-w-md">
      <Card title={t("title")}>
        <p className="mb-4 text-sm text-ink-600">{t("confirmIntro")}</p>
        <PasswordResetConfirm token={token!} customer />
      </Card>
    </div>
  );
}
