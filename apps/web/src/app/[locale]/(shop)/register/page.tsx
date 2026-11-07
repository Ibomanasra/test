import { formatPhone } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Alert, Card } from "@/components/ui";
import { Link, redirect } from "@/i18n/navigation";
import { getAuth } from "@/server/auth/context";
import { env } from "@/server/env";
import { readRegistrationTicket } from "@/server/services/auth";
import { listZones } from "@/server/services/settings";

export async function generateMetadata() {
  const t = await getTranslations("register");
  return { title: t("title") };
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string; type?: string; next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { t: token, type, next: rawNext } = await searchParams;
  // nur interne Pfade (z. B. /checkout) als Ziel nach der Registrierung
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : undefined;
  const auth = await getAuth();
  if (auth?.customer) redirect({ href: "/account", locale });
  const otp = env().CUSTOMER_LOGIN_OTP;
  // SMS-Modus: ohne bestätigte Nummer zuerst zum Code-Login (Registrierung folgt danach)
  if (otp && !token) redirect({ href: `/login${type ? `?type=${type === "b2b" ? "b2b" : "b2c"}` : ""}`, locale });

  const t = await getTranslations("register");
  let phone: string | null = null;
  if (otp) {
    try {
      phone = readRegistrationTicket(token!);
    } catch {
      phone = null;
    }
  }
  if (otp && !phone) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Alert tone="red">{t("expired")}</Alert>
        <Link href="/login" className="text-brand-700 underline">
          {(await getTranslations("common"))("login")}
        </Link>
      </div>
    );
  }
  const zones = (await listZones(true)).map((z) => ({ id: z.id, name: locale === "ar" ? z.nameAr : z.nameEn }));
  return (
    <div className="mx-auto max-w-2xl">
      <Card title={t("title")}>
        {phone ? (
          <p className="mb-4 text-sm text-ink-600">
            {t.rich("verifiedPhone", { phone: formatPhone(phone), num: (chunks) => <span className="num font-medium">{chunks}</span> })}
          </p>
        ) : (
          <p className="mb-4 text-sm text-ink-600">
            {t("haveAccount")} <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-brand-700 underline">{(await getTranslations("common"))("login")}</Link>
          </p>
        )}
        <RegisterForm token={otp ? token! : null} zones={zones} initialType={type === "b2b" ? "b2b" : "b2c"} maxUploadMb={env().UPLOAD_MAX_MB} next={next} />
      </Card>
    </div>
  );
}
