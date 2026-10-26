import { otpRequestSchema } from "@sa/contracts";
import { requestOtp } from "@/server/auth/otp";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";

export const POST = apiRoute(async (req) => {
  const { phone, purpose } = await parseJson(req, otpRequestSchema);
  const meta = await getRequestMeta();
  const locale = req.headers.get("accept-language")?.startsWith("en") ? "en" : "ar";
  return requestOtp({ phone, purpose, ip: meta.ip, locale });
});
