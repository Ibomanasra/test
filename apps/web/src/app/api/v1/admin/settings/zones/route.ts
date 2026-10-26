import { deliveryZoneSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { listZones, upsertZone } from "@/server/services/settings";

export const GET = apiRoute(async () => {
  await requireStaff("settings.view");
  return { items: await listZones() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return upsertZone(ctx, null, await parseJson(req, deliveryZoneSchema));
});
