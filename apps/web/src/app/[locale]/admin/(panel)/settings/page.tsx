import { hasPermission } from "@sa/core";
import { setRequestLocale } from "next-intl/server";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { Forbidden } from "@/components/admin/Forbidden";
import { staffPagePermission } from "@/server/auth/page-guards";
import { getCompanySettings } from "@/server/services/settings";

export default async function CompanySettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "settings.view");
  if (!auth) return <Forbidden />;
  const s = await getCompanySettings();
  // TODO(Phase 4): Logo-Upload, Bankdaten, Dokumenttexte AR/EN, Nummernkreise, Pflichtfelder Steuerrechnung
  return (
    <CompanyForm
      canEdit={hasPermission(auth.permissions, "settings.edit")}
      values={{
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        addressAr: s.addressAr,
        addressEn: s.addressEn,
        phone: s.phone,
        email: s.email,
        website: s.website,
        dealerNumber: s.dealerNumber,
        taxFileNumber: s.taxFileNumber,
        minMarginBps: s.minMarginBps,
        defaultPaymentTermDays: s.defaultPaymentTermDays,
        quoteValidityDays: s.quoteValidityDays,
      }}
    />
  );
}
