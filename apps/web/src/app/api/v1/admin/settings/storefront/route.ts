import { storefrontTextSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { updateStorefrontText } from "@/server/services/storefront";

export const PUT = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return updateStorefrontText(ctx, await parseJson(req, storefrontTextSchema));
});
