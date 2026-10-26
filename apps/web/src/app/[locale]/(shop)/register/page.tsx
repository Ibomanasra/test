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
  searchParams: Promise<{ t?: string; type?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { t: token, type } = await searchParams;
  const auth = await getAuth();
  if (auth?.customer) redirect({ href: "/account", locale });
  // Ohne verifizierte Telefonnummer zuerst zum OTP-Login (Registrierung folgt danach)
  if (!token) redirect({ href: `/login${type ? `?type=${type === "b2b" ? "b2b" : "b2c"}` : ""}`, locale });

  const t = await getTranslations("register");
  let phone: string | null = null;
  try {
    phone = readRegistrationTicket(token!);
  } catch {
    phone = null;
  }
  if (!phone) {
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
        <p className="mb-4 text-sm text-ink-600">
          {t.rich("verifiedPhone", { phone: formatPhone(phone), num: (chunks) => <span className="num font-medium">{chunks}</span> })}
        </p>
        <RegisterForm token={token!} zones={zones} initialType={type === "b2b" ? "b2b" : "b2c"} maxUploadMb={env().UPLOAD_MAX_MB} />
      </Card>
    </div>
  );
}
