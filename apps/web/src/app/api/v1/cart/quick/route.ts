import { quickOrderSchema } from "@sa/contracts";
import { requireB2BCustomer } from "@/server/auth/b2b";
import { apiRoute, parseJson } from "@/server/http";
import { cartOwner } from "@/server/services/cart";
import { quickOrder } from "@/server/services/lists";

export const POST = apiRoute(async (req) => {
  const ctx = await requireB2BCustomer();
  return quickOrder(cartOwner(ctx), (await parseJson(req, quickOrderSchema)).text);
});
