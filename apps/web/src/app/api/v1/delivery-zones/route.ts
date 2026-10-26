import { prisma } from "@sa/db";
import { getAuth } from "@/server/auth/context";
import { apiRoute } from "@/server/http";

/** Aktive Liefergebiete mit den Konditionen des eigenen Kanals (B2B-Konditionen nur für Händler). */
export const GET = apiRoute(async () => {
  const ctx = await getAuth();
  const channel = ctx?.channel ?? "B2C";
  const zones = await prisma.deliveryZone.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }],
    select: {
      id: true,
      code: true,
      nameAr: true,
      nameEn: true,
      deliveryWeekdays: true,
      rates: { where: { channel }, select: { feeGrossAgorot: true, minOrderAgorot: true, freeFromAgorot: true } },
    },
  });
  return { channel, zones: zones.map(({ rates, ...z }) => ({ ...z, rate: rates[0] ?? null })) };
});
