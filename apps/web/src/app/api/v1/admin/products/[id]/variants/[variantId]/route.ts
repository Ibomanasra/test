import { variantSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { upsertVariant } from "@/server/services/products-admin";

export const PUT = apiRoute<{ id: string; variantId: string }>(async (req, { params }) => {
  const ctx = await requireStaff("product.edit");
  const { id, variantId } = await params;
  return upsertVariant(ctx, id, variantId, await parseJson(req, variantSchema));
});
