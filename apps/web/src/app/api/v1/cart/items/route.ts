import { cartItemAddSchema } from "@sa/contracts";
import { getAuth } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { addCartItem, cartOwner, pricedCart } from "@/server/services/cart";
import { trackRequest } from "@/server/services/visits";

export const POST = apiRoute(async (req) => {
  const auth = await getAuth();
  const owner = cartOwner(auth);
  const input = await parseJson(req, cartItemAddSchema);
  await addCartItem(owner, input);
  // Besucherstatistik: „in den Warenkorb“
  await trackRequest(req, !!auth?.isStaff, { type: "cart", path: "/cart", variantId: input.variantId });
  return pricedCart(owner);
});
