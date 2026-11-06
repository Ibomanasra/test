import { prisma } from "@sa/db";
import { z } from "zod";
import { isExpoToken } from "@/server/adapters/push";
import { getAuth } from "@/server/auth/context";
import { badRequest, unauthorized } from "@/server/errors";
import { apiRoute, parseJson } from "@/server/http";

const schema = z.object({ token: z.string().min(10).max(200), platform: z.enum(["ios", "android"]) });

/** Gerät für Push registrieren (Token wandert bei Benutzerwechsel zum neuen Benutzer) */
export const POST = apiRoute(async (req) => {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  const { token, platform } = await parseJson(req, schema);
  if (!isExpoToken(token)) throw badRequest("invalid_push_token");
  await prisma.pushToken.upsert({ where: { token }, create: { token, platform, userId: ctx.user.id }, update: { userId: ctx.user.id, platform, lastSeenAt: new Date() } });
  return { ok: true };
});

export const DELETE = apiRoute(async (req) => {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  const token = req.nextUrl.searchParams.get("token") ?? "";
  await prisma.pushToken.deleteMany({ where: { token, userId: ctx.user.id } });
  return { ok: true };
});
