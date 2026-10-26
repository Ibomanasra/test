import { staffLoginSchema } from "@sa/contracts";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { startStaffLogin } from "@/server/services/auth";

export const POST = apiRoute(async (req) => {
  const { phone, password } = await parseJson(req, staffLoginSchema);
  const meta = await getRequestMeta();
  const locale = req.headers.get("accept-language")?.startsWith("en") ? "en" : "ar";
  return startStaffLogin(phone, password, meta.ip, locale);
});
