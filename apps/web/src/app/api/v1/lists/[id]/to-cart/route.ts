import { requireB2BCustomer } from "@/server/auth/b2b";
import { apiRoute } from "@/server/http";
import { cartOwner, pricedCart } from "@/server/services/cart";
import { addListToCart } from "@/server/services/lists";

export const POST = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireB2BCustomer();
  const owner = cartOwner(ctx);
  await addListToCart(owner, (await params).id);
  return pricedCart(owner);
});
