import { otpVerifySchema } from "@sa/contracts";
import { issueSession } from "@/server/auth/issue";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { verifyCustomerOtp } from "@/server/services/auth";

export const POST = apiRoute(async (req) => {
  const { phone, code, client } = await parseJson(req, otpVerifySchema);
  const meta = await getRequestMeta();
  const result = await verifyCustomerOtp(phone, code, { ip: meta.ip, userAgent: meta.userAgent, client });
  if (result.status === "needs_registration") return result;
  return { status: "logged_in", ...(await issueSession(result, client)) };
});
