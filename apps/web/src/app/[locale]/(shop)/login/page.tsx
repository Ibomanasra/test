import { getTranslations, setRequestLocale } from "next-intl/server";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { PasswordLoginForm } from "@/components/auth/PasswordLoginForm";
import { env } from "@/server/env";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";
import { getAuth } from "@/server/auth/context";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; type?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, type } = await searchParams;
  const auth = await getAuth();
  if (auth?.customer) redirect({ href: "/account", locale });
  const t = await getTranslations("auth");
  const regType = type === "b2b" ? "b2b" : type === "b2c" ? "b2c" : undefined;
  const regHref = `/register?${new URLSearchParams({ ...(regType ? { type: regType } : {}), ...(next ? { next } : {}) }).toString()}`;
  return (
    <div className="mx-auto max-w-md space-y-4">
      {!env().CUSTOMER_LOGIN_OTP ? (
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-lg" data-testid="new-customer-box">
          <p className="text-lg font-bold">✨ {t("newCustomerTitle")}</p>
          <p className="mt-1 text-sm text-white/90">{t("newCustomerText")}</p>
          <Link href={regHref} className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 font-semibold text-brand-800 shadow hover:bg-brand-50" data-testid="login-register">
            {t("newCustomerButton")} →
          </Link>
        </div>
      ) : null}
      <Card title={t("loginTitle")}>
        <p className="mb-4 text-sm text-ink-600">{env().CUSTOMER_LOGIN_OTP ? t("loginIntro") : t("loginIntroPassword")}</p>
        {env().CUSTOMER_LOGIN_OTP ? (
          <>
            <OtpLoginForm next={next} registerType={regType} />
            <p className="mt-4 text-xs text-ink-500">{t("newHere")}</p>
          </>
        ) : (
          <PasswordLoginForm next={next} registerType={regType} />
        )}
      </Card>
    </div>
  );
}
