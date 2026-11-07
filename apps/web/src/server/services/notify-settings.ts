import "server-only";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { badRequest } from "../errors";
import { TELEGRAM_EVENTS, saveTelegramConfig, telegramCall, telegramConfig, type TelegramChat, type TelegramEvent } from "../adapters/telegram";

/** Bot-Token prüfen (getMe) und speichern */
export async function connectTelegram(ctx: AuthContext, token: string) {
  const t = token.trim();
  if (!/^\d{5,}:[\w-]{20,}$/.test(t)) throw badRequest("telegram_invalid_token");
  let me: { username?: string };
  try {
    me = await telegramCall<{ username?: string }>(t, "getMe");
  } catch {
    throw badRequest("telegram_invalid_token");
  }
  await saveTelegramConfig({ token: t, botUsername: me.username ?? "" });
  await audit(ctx, { action: "notify.telegram.connect", entityType: "Setting", entityId: "notify.telegram", after: { bot: me.username } });
  return { botUsername: me.username ?? "" };
}

export async function disconnectTelegram(ctx: AuthContext) {
  await saveTelegramConfig({ token: "", botUsername: "", chats: [] });
  await audit(ctx, { action: "notify.telegram.disconnect", entityType: "Setting", entityId: "notify.telegram" });
}

/** Chats, die dem Bot zuletzt geschrieben haben bzw. in denen er Mitglied wurde */
export async function discoverTelegramChats() {
  const cfg = await telegramConfig();
  if (!cfg.token) throw badRequest("telegram_not_connected");
  type Chat = { id: number; title?: string; first_name?: string; last_name?: string; username?: string; type: string };
  type Update = { message?: { chat: Chat }; my_chat_member?: { chat: Chat }; channel_post?: { chat: Chat } };
  const updates = await telegramCall<Update[]>(cfg.token, "getUpdates", { limit: 100, allowed_updates: ["message", "my_chat_member", "channel_post"] }).catch(() => {
    throw badRequest("telegram_unreachable");
  });
  const seen = new Map<string, { id: string; title: string; type: string }>();
  for (const u of updates) {
    const c = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat;
    if (!c) continue;
    const title = c.title ?? ([c.first_name, c.last_name].filter(Boolean).join(" ") || (c.username ? `@${c.username}` : String(c.id)));
    seen.set(String(c.id), { id: String(c.id), title, type: c.type });
  }
  return [...seen.values()];
}

export async function saveTelegramChats(ctx: AuthContext, chats: TelegramChat[]) {
  const clean = chats.slice(0, 20).map((c) => ({ id: String(c.id).slice(0, 32), title: c.title.slice(0, 120), events: c.events.filter((e): e is TelegramEvent => (TELEGRAM_EVENTS as readonly string[]).includes(e)) }));
  await saveTelegramConfig({ chats: clean });
  await audit(ctx, { action: "notify.telegram.chats", entityType: "Setting", entityId: "notify.telegram", after: { chats: clean.map((c) => ({ title: c.title, events: c.events })) } });
}

export async function testTelegram(chatId: string) {
  const cfg = await telegramConfig();
  if (!cfg.token) throw badRequest("telegram_not_connected");
  await telegramCall(cfg.token, "sendMessage", { chat_id: chatId, text: "✅ شعلة الجنوب – الإشعارات تعمل!\nSholat Aljanoub – notifications work!" }).catch(() => {
    throw badRequest("telegram_send_failed");
  });
}

export async function telegramStatus() {
  const cfg = await telegramConfig();
  return { connected: Boolean(cfg.token), botUsername: cfg.botUsername, chats: cfg.chats };
}
