import "server-only";
import { prisma } from "@sa/db";
import { env } from "../env";

/**
 * Push-Benachrichtigungen an die Mobile-App über den Expo-Push-Dienst.
 * "log" (Standard) protokolliert nur; "expo" sendet an https://exp.host.
 * Ungültige Token (DeviceNotRegistered) werden entfernt.
 */

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

type Fetch = typeof fetch;

export function isExpoToken(t: string): boolean {
  return /^Expo(nent)?PushToken\[[\w-]+\]$/.test(t);
}

/** Expo erlaubt bis zu 100 Nachrichten je Anfrage */
export async function sendExpoPush(tokens: string[], m: PushMessage, http: Fetch = fetch, accessToken = ""): Promise<string[]> {
  const invalid: string[] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    const res = await http("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(chunk.map((to) => ({ to, title: m.title, body: m.body, data: m.data ?? {}, sound: "default" }))),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };
    json.data?.forEach((r, idx) => {
      if (r.status === "error" && r.details?.error === "DeviceNotRegistered") invalid.push(chunk[idx]!);
    });
  }
  return invalid;
}

/** An alle Geräte eines oder mehrerer Benutzer senden – Fehler blockieren nie den Vorgang */
export async function pushToUsers(userIds: string[], m: PushMessage): Promise<void> {
  if (!userIds.length) return;
  try {
    const tokens = (await prisma.pushToken.findMany({ where: { userId: { in: userIds } }, select: { token: true } })).map((t) => t.token);
    if (!tokens.length) return;
    if (env().PUSH_PROVIDER !== "expo") {
      if (env().NODE_ENV !== "test") console.info(`[PUSH:log] → ${tokens.length} device(s): ${m.title} – ${m.body}`);
      return;
    }
    const invalid = await sendExpoPush(tokens, m, fetch, env().EXPO_ACCESS_TOKEN);
    if (invalid.length) await prisma.pushToken.deleteMany({ where: { token: { in: invalid } } });
  } catch (err) {
    console.error("[push]", err);
  }
}
