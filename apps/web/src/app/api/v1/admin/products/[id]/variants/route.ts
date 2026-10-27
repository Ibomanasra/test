import { variantSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { upsertVariant } from "@/server/services/products-admin";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("product.edit");
  return upsertVariant(ctx, (await params).id, null, await parseJson(req, variantSchema));
});
