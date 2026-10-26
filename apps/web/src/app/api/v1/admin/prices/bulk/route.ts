import { bulkAdjustSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { bulkAdjustPrices } from "@/server/services/prices-admin";

/** apply=false → Vorschau („was ändert sich“), apply=true → ausführen bzw. planen */
export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("price.bulk");
  return bulkAdjustPrices(ctx, await parseJson(req, bulkAdjustSchema));
});
