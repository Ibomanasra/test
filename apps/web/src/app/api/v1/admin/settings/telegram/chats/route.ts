import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { saveTelegramChats } from "@/server/services/notify-settings";

const schema = z.object({
  chats: z.array(z.object({ id: z.string().max(32), title: z.string().max(120), events: z.array(z.string().max(32)).max(10) })).max(20),
});

export const PUT = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  const { chats } = await parseJson(req, schema);
  await saveTelegramChats(ctx, chats as Parameters<typeof saveTelegramChats>[1]);
  return { ok: true };
});
