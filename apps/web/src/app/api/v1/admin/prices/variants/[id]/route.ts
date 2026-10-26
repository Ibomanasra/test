import { variantPriceUpdateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { updateVariantPrices } from "@/server/services/prices-admin";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("price.edit");
  return updateVariantPrices(ctx, (await params).id, await parseJson(req, variantPriceUpdateSchema));
});
