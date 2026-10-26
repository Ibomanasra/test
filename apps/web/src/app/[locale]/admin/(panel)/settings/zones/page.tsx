import { hasPermission } from "@sa/core";
import { setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { ZonesEditor } from "@/components/admin/ZonesEditor";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listZones } from "@/server/services/settings";

export default async function ZonesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "settings.view");
  if (!auth) return <Forbidden />;
  const zones = await listZones();
  return (
    <ZonesEditor
      locale={locale}
      canEdit={hasPermission(auth.permissions, "settings.edit")}
      zones={zones.map((z) => ({
        id: z.id,
        code: z.code,
        nameAr: z.nameAr,
        nameEn: z.nameEn,
        active: z.active,
        sortOrder: z.sortOrder,
        deliveryWeekdays: z.deliveryWeekdays,
        rates: z.rates.map((r) => ({ channel: r.channel, feeGrossAgorot: r.feeGrossAgorot, minOrderAgorot: r.minOrderAgorot, freeFromAgorot: r.freeFromAgorot })),
      }))}
    />
  );
}
