import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordResetConfirm, PasswordResetRequest } from "@/components/auth/PasswordResetForms";
import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/ui";

export default async function ResetPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("auth.reset");
  return (
    <main className="grid min-h-dvh place-items-center bg-ink-100 p-4">
      <div className="w-full max-w-sm space-y-4">
        <Logo size={96} />
        <Card title={t("title")}>
          <p className="mb-4 text-sm text-ink-600">{token ? t("confirmIntro") : t("requestIntro")}</p>
          {token ? <PasswordResetConfirm token={token} /> : <PasswordResetRequest />}
        </Card>
      </div>
    </main>
  );
}
