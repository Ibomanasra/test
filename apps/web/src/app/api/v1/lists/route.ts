import { listCreateSchema } from "@sa/contracts";
import { requireB2BCustomer } from "@/server/auth/b2b";
import { apiRoute, parseJson } from "@/server/http";
import { cartOwner } from "@/server/services/cart";
import { listOrderLists, saveCartAsList } from "@/server/services/lists";

export const GET = apiRoute(async () => ({ items: await listOrderLists((await requireB2BCustomer()).customer.id) }));

export const POST = apiRoute(async (req) => {
  const ctx = await requireB2BCustomer();
  return saveCartAsList(cartOwner(ctx), (await parseJson(req, listCreateSchema)).name);
});
