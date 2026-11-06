import "server-only";
import { prisma, type Tx } from "@sa/db";
import { badRequest } from "../errors";

/** Sammelzone für Orte, die (noch) keiner Lieferzone zugeordnet sind */
export const OTHER_ZONE_CODE = "OTHER";

/** Vergleichsform: ohne Artikel/Leerzeichen/Diakritika, Alef/Ta-Marbuta vereinheitlicht */
export function normalizePlace(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟ̀-ͯ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/(^|\s)(ال|al-?|el-?)/g, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Lieferzone für eine Adresse: explizit gewählte Zone (muss aktiv sein),
 * sonst Treffer über den Ortsnamen, sonst die Sammelzone „مناطق أخرى“.
 */
export async function resolveZoneId(city: string, zoneId?: string, db: Tx | typeof prisma = prisma): Promise<string> {
  if (zoneId) {
    const z = await db.deliveryZone.findFirst({ where: { id: zoneId, active: true }, select: { id: true } });
    if (!z) throw badRequest("invalid_zone");
    return z.id;
  }
  const zones = await db.deliveryZone.findMany({ where: { active: true }, select: { id: true, code: true, nameAr: true, nameEn: true } });
  const c = normalizePlace(city);
  if (c) {
    const hit = zones.find((z) => z.code !== OTHER_ZONE_CODE && [z.nameAr, z.nameEn, ...z.nameAr.split(/\s+و|\//), ...z.nameEn.split("/")].some((n) => normalizePlace(n) === c));
    if (hit) return hit.id;
  }
  const other = zones.find((z) => z.code === OTHER_ZONE_CODE);
  if (!other) throw badRequest("invalid_zone");
  return other.id;
}
