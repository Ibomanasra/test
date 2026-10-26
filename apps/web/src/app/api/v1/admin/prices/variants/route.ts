import { priceListQuerySchema } from "@sa/contracts";
import { hasPermission } from "@sa/core";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseQuery } from "@/server/http";
import { listVariantPrices } from "@/server/services/prices-admin";

export const GET = apiRoute(async (req) => {
  const ctx = await requireStaff("price.view");
  const data = await listVariantPrices(parseQuery(req, priceListQuerySchema));
  // Einkaufspreis/Marge nur mit eigenem Recht
  if (!hasPermission(ctx.permissions, "price.view_cost")) {
    return { ...data, items: data.items.map(({ costPrice: _c, marginB2cBps: _m1, marginB2bBps: _m2, belowMargin: _b, ...rest }) => rest) };
  }
  return data;
});
