import { guestOrderSchema } from "@sa/contracts";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { placeGuestOrder } from "@/server/services/guest-checkout";

/** Bestellung ohne Konto */
export const POST = apiRoute(async (req) => {
  const meta = await getRequestMeta();
  return placeGuestOrder(await parseJson(req, guestOrderSchema), meta.ip);
});
