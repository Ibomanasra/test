import { stockAdjustSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { adjustStock } from "@/server/services/inventory";

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("stock.adjust");
  const m = await adjustStock(ctx, await parseJson(req, stockAdjustSchema));
  return { id: m.id };
});
