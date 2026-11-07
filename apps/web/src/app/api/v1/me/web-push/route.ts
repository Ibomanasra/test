import { prisma } from "@sa/db";
import { z } from "zod";
import { vapidKeys } from "@/server/adapters/web-push";
import { getAuth } from "@/server/auth/context";
import { badRequest, unauthorized } from "@/server/errors";
import { apiRoute, parseJson } from "@/server/http";

const schema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Öffentlicher VAPID-Schlüssel für das Abonnieren im Browser */
export const GET = apiRoute(async () => {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  return { publicKey: (await vapidKeys()).publicKey };
});

/** Browser für Benachrichtigungen registrieren (Abo wandert bei Benutzerwechsel zum neuen Benutzer) */
export const POST = apiRoute(async (req) => {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  const { endpoint, keys } = await parseJson(req, schema);
  if (!endpoint.startsWith("https://")) throw badRequest("invalid_push_token");
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  await prisma.webPushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent, userId: ctx.user.id },
    update: { p256dh: keys.p256dh, auth: keys.auth, userAgent, userId: ctx.user.id, lastSeenAt: new Date() },
  });
  return { ok: true };
});

export const DELETE = apiRoute(async (req) => {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  const endpoint = req.nextUrl.searchParams.get("endpoint") ?? "";
  await prisma.webPushSubscription.deleteMany({ where: { endpoint, userId: ctx.user.id } });
  return { ok: true };
});
