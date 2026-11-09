import { guestOrderSchema } from "@sa/contracts";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { placeGuestOrder } from "@/server/services/guest-checkout";
import { trackRequest } from "@/server/services/visits";

/** Bestellung ohne Konto */
export const POST = apiRoute(async (req) => {
  const meta = await getRequestMeta();
  const res = await placeGuestOrder(await parseJson(req, guestOrderSchema), meta.ip);
  await trackRequest(req, false, { type: "order", path: "/checkout" });
  return res;
});
