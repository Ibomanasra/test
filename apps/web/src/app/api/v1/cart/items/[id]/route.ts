import { cartItemQtySchema } from "@sa/contracts";
import { getAuth } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { cartOwner, pricedCart, setCartItemQty } from "@/server/services/cart";

export const PATCH = apiRoute<{ id: string }>(async (req, { params }) => {
  const owner = cartOwner(await getAuth());
  await setCartItemQty(owner, (await params).id, (await parseJson(req, cartItemQtySchema)).qty);
  return pricedCart(owner);
});

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const owner = cartOwner(await getAuth());
  await setCartItemQty(owner, (await params).id, 0);
  return pricedCart(owner);
});
