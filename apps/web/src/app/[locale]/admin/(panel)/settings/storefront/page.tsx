import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { StorefrontSettings } from "@/components/admin/StorefrontSettings";
import { staffPagePermission } from "@/server/auth/page-guards";
import { getStorefront } from "@/server/services/storefront";

export default async function StorefrontSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "settings.view");
  if (!auth) return <Forbidden />;
  const [s, t] = await Promise.all([getStorefront(), getTranslations({ locale: "ar", namespace: "shop.hero" })]);
  return (
    <StorefrontSettings
      canEdit={hasPermission(auth.permissions, "settings.edit")}
      defaults={{ titleAr: t("title"), textAr: t("text", { count: s.productCount }) }}
      v={{ heroTitleAr: s.titleAr ?? "", heroTitleEn: s.titleEn ?? "", heroTextAr: s.textAr ?? "", heroTextEn: s.textEn ?? "", imageFileId: s.imageFileId }}
    />
  );
}
