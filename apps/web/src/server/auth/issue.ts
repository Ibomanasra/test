import "server-only";
import type { SessionClient } from "@sa/db";
import { setSessionCookie } from "./session";

/** Web: Session als httpOnly-Cookie. Mobile: Token im JSON (App speichert es im SecureStore). */
export async function issueSession(s: { token: string; expiresAt: Date }, client: SessionClient) {
  if (client === "MOBILE") return { token: s.token, expiresAt: s.expiresAt.toISOString() };
  await setSessionCookie(s.token, s.expiresAt);
  return { expiresAt: s.expiresAt.toISOString() };
}
