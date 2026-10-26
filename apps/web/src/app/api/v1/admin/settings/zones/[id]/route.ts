import { deliveryZoneSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { upsertZone } from "@/server/services/settings";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("settings.edit");
  return upsertZone(ctx, (await params).id, await parseJson(req, deliveryZoneSchema));
});
