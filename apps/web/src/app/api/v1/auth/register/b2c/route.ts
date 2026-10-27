import { registerB2CSchema } from "@sa/contracts";
import { issueSession } from "@/server/auth/issue";
import { createSession } from "@/server/auth/session";
import { mergeGuestCart } from "@/server/services/cart";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { readRegistrationTicket } from "@/server/services/auth";
import { registerB2C } from "@/server/services/customers";

export const POST = apiRoute(async (req) => {
  const input = await parseJson(req, registerB2CSchema);
  const phone = readRegistrationTicket(input.registrationToken);
  const { user, customer } = await registerB2C(phone, input);
  await mergeGuestCart(customer.id);
  const meta = await getRequestMeta();
  const client = req.headers.get("x-client") === "mobile" ? "MOBILE" : "WEB";
  const s = await createSession({ userId: user.id, kind: "CUSTOMER", mfaPassed: true, client, ip: meta.ip, userAgent: meta.userAgent });
  return { customer: { id: customer.id, number: customer.number, status: customer.status }, ...(await issueSession(s, client)) };
});
