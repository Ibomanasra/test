import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordResetRequest } from "@/components/auth/PasswordResetForms";
import { Card } from "@/components/ui";
import { getCompanySettings } from "@/server/services/settings";

/** Kunden: Passwort vergessen – Link per E-Mail oder per WhatsApp beim Geschäft melden (kostenlos) */
export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, company] = await Promise.all([getTranslations("auth.reset"), getCompanySettings()]);
  const digits = (company?.phone ?? "").replace(/\D/g, "");
  const wa = digits.length >= 9 ? `https://wa.me/${digits.replace(/^0/, "970")}?text=${encodeURIComponent(t("waText"))}` : null;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card title={t("title")}>
        <p className="mb-4 text-sm text-ink-600">{t("requestIntroCustomer")}</p>
        <PasswordResetRequest customer />
      </Card>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener" className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-white shadow hover:brightness-95" data-testid="whatsapp-help">
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .2-3.4-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3z" /></svg>
          {t("whatsapp")}
        </a>
      ) : null}
    </div>
  );
}
