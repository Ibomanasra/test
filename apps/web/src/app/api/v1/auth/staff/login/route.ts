import { staffLoginSchema } from "@sa/contracts";
import { issueSession } from "@/server/auth/issue";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { startStaffLogin } from "@/server/services/auth";

/** Benutzername + Passwort → angemeldet; mit STAFF_LOGIN_OTP zuerst { ticket } für den SMS-Code */
export const POST = apiRoute(async (req) => {
  const { login, password, client } = await parseJson(req, staffLoginSchema);
  const meta = await getRequestMeta();
  const locale = req.headers.get("accept-language")?.startsWith("en") ? "en" : "ar";
  const r = await startStaffLogin(login, password, { ip: meta.ip, userAgent: meta.userAgent, client }, locale);
  if (r.session) return issueSession(r.session, client);
  return { ticket: r.ticket };
});
