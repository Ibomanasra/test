import { getTranslations, setRequestLocale } from "next-intl/server";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { Card } from "@/components/ui";
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
  return (
    <div className="mx-auto max-w-md">
      <Card title={t("loginTitle")}>
        <p className="mb-4 text-sm text-ink-600">{t("loginIntro")}</p>
        <OtpLoginForm next={next} registerType={type === "b2b" ? "b2b" : type === "b2c" ? "b2c" : undefined} />
        <p className="mt-4 text-xs text-ink-500">{t("newHere")}</p>
      </Card>
    </div>
  );
}
