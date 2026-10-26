import { clearSessionCookie, readSessionToken, revokeSession } from "@/server/auth/session";
import { apiRoute } from "@/server/http";

export const POST = apiRoute(async () => {
  const t = await readSessionToken();
  if (t) await revokeSession(t.token);
  await clearSessionCookie();
  return { ok: true };
});
