import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { discoverTelegramChats } from "@/server/services/notify-settings";

export const POST = apiRoute(async () => {
  await requireStaff("settings.edit");
  return { chats: await discoverTelegramChats() };
});
