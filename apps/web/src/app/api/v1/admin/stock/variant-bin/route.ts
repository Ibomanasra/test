import { variantBinSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { setVariantBin } from "@/server/services/inventory";

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("stock.bins");
  const input = await parseJson(req, variantBinSchema);
  await setVariantBin(ctx, input.sku, input.binId);
  return { ok: true };
});
