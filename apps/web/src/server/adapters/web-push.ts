import "server-only";
import { prisma } from "@sa/db";
import webpush from "web-push";
import { env } from "../env";
import type { PushMessage } from "./push";

/**
 * Browser-Push (Web Push mit VAPID) – kostenlos, kein Fremdanbieter-Konto nötig.
 * Die VAPID-Schlüssel werden beim ersten Bedarf erzeugt und in der Datenbank (Setting) gespeichert,
 * damit auf dem Server nichts eingerichtet werden muss.
 */

const KEY = "webpush.vapid";
let cached: { publicKey: string; privateKey: string } | null = null;

export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (cached) return cached;
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const v = row?.value as { publicKey?: string; privateKey?: string } | undefined;
  if (v?.publicKey && v.privateKey) return (cached = { publicKey: v.publicKey, privateKey: v.privateKey });
  const k = webpush.generateVAPIDKeys();
  const keys = { publicKey: k.publicKey, privateKey: k.privateKey };
  // bei gleichzeitigem Erzeugen gewinnt der erste Eintrag
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: keys }, update: {} });
  const saved = (await prisma.setting.findUniqueOrThrow({ where: { key: KEY } })).value as { publicKey: string; privateKey: string };
  return (cached = { publicKey: saved.publicKey, privateKey: saved.privateKey });
}

/** An alle Browser-Abos der Benutzer senden; abgelaufene Abos (404/410) werden entfernt */
export async function sendWebPush(userIds: string[], m: PushMessage): Promise<number> {
  const subs = await prisma.webPushSubscription.findMany({ where: { userId: { in: userIds } } });
  if (!subs.length) return 0;
  const { publicKey, privateKey } = await vapidKeys();
  const subject = env().APP_URL.startsWith("https://") ? env().APP_URL : "mailto:admin@sholataljanoub.com";
  const payload = JSON.stringify({ title: m.title, body: m.body, url: typeof m.data?.url === "string" ? m.data.url : undefined, tag: m.data?.tag });
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { vapidDetails: { subject, publicKey, privateKey }, TTL: 60 * 60 * 12, urgency: "high", timeout: 5000 });
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
        else console.error("[web-push]", code, (err as Error).message);
      }
    }),
  );
  if (gone.length) await prisma.webPushSubscription.deleteMany({ where: { id: { in: gone } } });
  return sent;
}
