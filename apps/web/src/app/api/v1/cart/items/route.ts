import { cartItemAddSchema } from "@sa/contracts";
import { getAuth } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { addCartItem, cartOwner, pricedCart } from "@/server/services/cart";

export const POST = apiRoute(async (req) => {
  const owner = cartOwner(await getAuth());
  await addCartItem(owner, await parseJson(req, cartItemAddSchema));
  return pricedCart(owner);
});
