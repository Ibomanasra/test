import { categorySchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { upsertCategory } from "@/server/services/products-admin";

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("product.edit");
  return upsertCategory(ctx, null, await parseJson(req, categorySchema));
});
