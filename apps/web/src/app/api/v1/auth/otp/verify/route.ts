import { otpVerifySchema } from "@sa/contracts";
import { prisma } from "@sa/db";
import { issueSession } from "@/server/auth/issue";
import { mergeGuestCart } from "@/server/services/cart";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { verifyCustomerOtp } from "@/server/services/auth";

export const POST = apiRoute(async (req) => {
  const { phone, code, client } = await parseJson(req, otpVerifySchema);
  const meta = await getRequestMeta();
  const result = await verifyCustomerOtp(phone, code, { ip: meta.ip, userAgent: meta.userAgent, client });
  if (result.status === "needs_registration") return result;
  const issued = await issueSession(result, client);
  const me = await prisma.customerMember.findFirst({ where: { user: { phone } }, select: { customerId: true } });
  if (me) await mergeGuestCart(me.customerId);
  return { status: "logged_in", ...issued };
});
