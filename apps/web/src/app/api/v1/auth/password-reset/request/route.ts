import { z } from "zod";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { requestPasswordReset } from "@/server/services/password-reset";

const schema = z.object({ identifier: z.string().trim().min(3).max(200) });

export const POST = apiRoute(async (req) => {
  const { identifier } = await parseJson(req, schema);
  const meta = await getRequestMeta();
  return requestPasswordReset(identifier, meta.ip, req.headers.get("accept-language")?.startsWith("en") ? "en" : "ar");
});
