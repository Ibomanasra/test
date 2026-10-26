import { hasPermission } from "@sa/core";
import { setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { TaxRates } from "@/components/admin/TaxRates";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listTaxRates } from "@/server/services/settings";

export default async function TaxSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "settings.view");
  if (!auth) return <Forbidden />;
  const rates = await listTaxRates();
  return (
    <TaxRates
      now={new Date().toISOString()}
      canEdit={hasPermission(auth.permissions, "settings.edit")}
      rates={rates.map((r) => ({ id: r.id, code: r.code, rateBps: r.rateBps, validFrom: r.validFrom.toISOString(), validTo: r.validTo?.toISOString() ?? null }))}
    />
  );
}
