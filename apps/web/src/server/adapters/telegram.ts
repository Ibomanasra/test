import "server-only";
import { prisma, type Prisma } from "@sa/db";
import { env } from "../env";

/**
 * Telegram-Benachrichtigungen (kostenlos): ein Bot schickt Nachrichten an ausgewählte Chats/Gruppen.
 * Token und Chats stehen in der Datenbank (Einstellungen → Benachrichtigungen); TELEGRAM_BOT_TOKEN in .env hat Vorrang.
 */

export const TELEGRAM_EVENTS = ["order.new", "stock.low", "dealer.new"] as const;
export type TelegramEvent = (typeof TELEGRAM_EVENTS)[number];

export interface TelegramChat {
  id: string;
  title: string;
  events: TelegramEvent[];
}

interface TelegramConfig {
  token: string;
  botUsername: string;
  chats: TelegramChat[];
}

const KEY = "notify.telegram";

export async function telegramConfig(): Promise<TelegramConfig> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const v = (row?.value ?? {}) as Partial<TelegramConfig>;
  return { token: env().TELEGRAM_BOT_TOKEN || v.token || "", botUsername: v.botUsername ?? "", chats: Array.isArray(v.chats) ? v.chats : [] };
}

export async function saveTelegramConfig(patch: Partial<TelegramConfig>) {
  const cur = await prisma.setting.findUnique({ where: { key: KEY } });
  const next = JSON.parse(JSON.stringify({ ...((cur?.value ?? {}) as object), ...patch })) as Prisma.InputJsonObject;
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: next }, update: { value: next } });
}

/** Aufruf der Bot-API; wirft bei Fehlern mit der Telegram-Beschreibung */
export async function telegramCall<T>(token: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${env().TELEGRAM_API_URL}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!res.ok || !json.ok) throw new Error(json.description ?? `telegram ${res.status}`);
  return json.result as T;
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Nachricht an alle Chats, die dieses Ereignis abonniert haben – Fehler blockieren nie den Vorgang */
export async function sendTelegram(event: TelegramEvent, html: string, link?: { url: string; label: string }) {
  try {
    const cfg = await telegramConfig();
    if (!cfg.token) return;
    const chats = cfg.chats.filter((c) => c.events.includes(event));
    if (!chats.length) return;
    const base = env().APP_URL;
    // Knöpfe nur mit öffentlicher https-Adresse (Telegram lehnt localhost ab)
    const button = link && base.startsWith("https://") ? { reply_markup: { inline_keyboard: [[{ text: link.label, url: new URL(link.url, base).href }]] } } : {};
    await Promise.all(
      chats.map((c) =>
        telegramCall(cfg.token, "sendMessage", { chat_id: c.id, text: html, parse_mode: "HTML", disable_web_page_preview: true, ...button }).catch((err: unknown) =>
          console.error("[telegram]", c.id, (err as Error).message),
        ),
      ),
    );
  } catch (err) {
    console.error("[telegram]", err);
  }
}
