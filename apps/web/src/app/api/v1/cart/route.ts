import { getAuth } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { cartOwner, pricedCart } from "@/server/services/cart";

export const GET = apiRoute(async () => pricedCart(cartOwner(await getAuth())));
