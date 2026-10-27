import { cartQuoteSchema } from "@sa/contracts";
import { requireB2BCustomer } from "@/server/auth/b2b";
import { apiRoute, parseJson } from "@/server/http";
import { applyQuoteToCart, cartOwner, pricedCart } from "@/server/services/cart";

export const POST = apiRoute(async (req) => {
  const ctx = await requireB2BCustomer();
  const owner = cartOwner(ctx);
  await applyQuoteToCart(owner, (await parseJson(req, cartQuoteSchema)).quoteId);
  return pricedCart(owner);
});
