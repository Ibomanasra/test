import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { connectTelegram, disconnectTelegram, telegramStatus } from "@/server/services/notify-settings";

export const GET = apiRoute(async () => {
  await requireStaff("settings.view");
  return telegramStatus();
});

/** Bot verbinden (Token wird geprüft und gespeichert, nie zurückgegeben) */
export const PUT = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  const { token } = await parseJson(req, z.object({ token: z.string().max(200) }));
  return connectTelegram(ctx, token);
});

export const DELETE = apiRoute(async () => {
  const ctx = await requireStaff("settings.edit");
  await disconnectTelegram(ctx);
  return { ok: true };
});
