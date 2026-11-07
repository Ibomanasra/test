import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { setOwnDrivers } from "@/server/services/delivery-mode";

/** Eigene Fahrer ein-/ausschalten */
export const PUT = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  const { enabled } = await parseJson(req, z.object({ enabled: z.boolean() }));
  await setOwnDrivers(ctx, enabled);
  return { enabled };
});
