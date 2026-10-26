import { otpCodeSchema } from "@sa/contracts";
import { z } from "zod";
import { issueSession } from "@/server/auth/issue";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { finishStaffLogin } from "@/server/services/auth";

const schema = z.object({ ticket: z.string().min(10), code: otpCodeSchema, client: z.enum(["WEB", "MOBILE"]).default("WEB") });

export const POST = apiRoute(async (req) => {
  const { ticket, code, client } = await parseJson(req, schema);
  const meta = await getRequestMeta();
  const s = await finishStaffLogin(ticket, code, { ip: meta.ip, userAgent: meta.userAgent, client });
  return issueSession(s, client);
});
