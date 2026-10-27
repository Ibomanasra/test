import { reorderSchema } from "@sa/contracts";
import { requireCustomer } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { cartOwner, pricedCart } from "@/server/services/cart";
import { reorderToCart } from "@/server/services/orders";

export const POST = apiRoute(async (req) => {
  const ctx = await requireCustomer();
  const owner = cartOwner(ctx);
  await reorderToCart(owner, (await parseJson(req, reorderSchema)).orderId);
  return pricedCart(owner);
});
