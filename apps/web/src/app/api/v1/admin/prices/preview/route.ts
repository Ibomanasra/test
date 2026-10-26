import { pricePreviewSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseQuery } from "@/server/http";
import { previewPrice } from "@/server/services/prices-admin";

export const GET = apiRoute(async (req) => {
  await requireStaff("price.view");
  return previewPrice(parseQuery(req, pricePreviewSchema));
});
