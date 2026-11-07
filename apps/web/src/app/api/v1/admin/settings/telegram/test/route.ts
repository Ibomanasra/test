import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { testTelegram } from "@/server/services/notify-settings";

export const POST = apiRoute(async (req) => {
  await requireStaff("settings.edit");
  const { chatId } = await parseJson(req, z.object({ chatId: z.string().max(32) }));
  await testTelegram(chatId);
  return { ok: true };
});
