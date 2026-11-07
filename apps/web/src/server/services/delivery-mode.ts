import "server-only";
import { prisma } from "@sa/db";
import { cache } from "react";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";

const KEY = "delivery.ownDrivers";

/**
 * Eigene Fahrer (Touren, Fahrer-Kasse, Fahrerauswahl) – standardmäßig AUS,
 * weil über externe Zustellfirmen geliefert wird. In Einstellungen → Zustellfirmen umschaltbar.
 */
export const ownDriversEnabled = cache(async (): Promise<boolean> => {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  return row?.value === true;
});

export async function setOwnDrivers(ctx: AuthContext, enabled: boolean) {
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: enabled }, update: { value: enabled } });
  await audit(ctx, { action: "settings.own_drivers", entityType: "Setting", entityId: KEY, after: { enabled } });
}
