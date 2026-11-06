import "server-only";
import { maskPhone } from "@sa/core";
import { prisma, type Locale } from "@sa/db";
import { env } from "../env";

export interface OutgoingMessage {
  to: string;
  template: string;
  locale: Locale;
  text: string;
  payload?: Record<string, unknown>;
}

export interface MessageAdapter {
  readonly name: string;
  send(message: OutgoingMessage): Promise<void>;
}

type Channel = "SMS" | "WHATSAPP";
type Fetch = typeof fetch;

/**
 * Entwicklungs-/Start-Adapter: schreibt die Nachricht nur ins NotificationLog
 * und in die Server-Konsole (Codes bewusst im Log, damit Tests/Demo ohne SMS funktionieren).
 */
export class LogAdapter implements MessageAdapter {
  constructor(
    readonly name: string,
    private readonly channel: Channel,
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
    await prisma.notificationLog.create({
      data: { channel: this.channel, to: message.to, template: message.template, locale: message.locale, payload: { text: message.text, ...message.payload }, status: "LOGGED", provider: this.name },
    });
    if (env().NODE_ENV !== "test") console.info(`[${this.channel}:${this.name}] → ${maskPhone(message.to)}: ${message.text}`);
  }
}

/** Echte Anbieter: Versand + Protokoll ohne Klartext-Codes (OTP wird im Log geschwärzt) */
abstract class RemoteAdapter implements MessageAdapter {
  abstract readonly name: string;
  protected abstract readonly channel: Channel;
  protected abstract deliver(m: OutgoingMessage): Promise<void>;

  async send(m: OutgoingMessage): Promise<void> {
    let error: string | null = null;
    try {
      await this.deliver(m);
    } catch (err) {
      error = err instanceof Error ? err.message.slice(0, 500) : String(err);
    }
    const text = m.template === "otp" ? m.text.replace(/\d{4,8}/g, "••••••") : m.text;
    await prisma.notificationLog.create({
      data: { channel: this.channel, to: m.to, template: m.template, locale: m.locale, payload: { text, ...m.payload }, status: error ? "FAILED" : "SENT", provider: this.name, error },
    });
    // Nur der Login-Code muss ankommen – Statusmeldungen dürfen fachliche Vorgänge nie blockieren
    if (error && m.template === "otp") throw new Error(`${this.channel} delivery failed: ${error}`);
    if (error) console.error(`[${this.channel}:${this.name}] delivery failed`, error);
  }
}

/**
 * Generischer HTTP-SMS-Anbieter (z. B. lokale Bulk-SMS-Gateways):
 * POST SMS_API_URL, Authorization: Bearer SMS_API_KEY, JSON { to, from, text }.
 */
export class HttpSmsAdapter extends RemoteAdapter {
  readonly name = "http";
  protected readonly channel = "SMS" as const;
  constructor(
    private readonly cfg: { url: string; apiKey: string; sender: string },
    private readonly http: Fetch = fetch,
  ) {
    super();
  }

  protected async deliver(m: OutgoingMessage) {
    const res = await this.http(this.cfg.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({ to: m.to, from: this.cfg.sender, text: m.text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}

/**
 * WhatsApp Business Cloud API (Meta): Textnachricht an die Nummer.
 * Hinweis: Freitext nur innerhalb von 24 h nach Kundenkontakt; sonst freigegebene Vorlagen nötig.
 */
export class WhatsAppCloudAdapter extends RemoteAdapter {
  readonly name = "cloud";
  protected readonly channel = "WHATSAPP" as const;
  constructor(
    private readonly cfg: { apiUrl: string; phoneNumberId: string; token: string },
    private readonly http: Fetch = fetch,
  ) {
    super();
  }

  protected async deliver(m: OutgoingMessage) {
    const res = await this.http(`${this.cfg.apiUrl}/${encodeURIComponent(this.cfg.phoneNumberId)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: m.to.replace(/^\+/, ""), type: "text", text: { body: m.text, preview_url: true } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}

let sms: MessageAdapter | undefined;
let whatsapp: MessageAdapter | undefined;

export function smsAdapter(): MessageAdapter {
  if (sms) return sms;
  const e = env();
  sms = e.SMS_PROVIDER === "http" && e.SMS_API_URL ? new HttpSmsAdapter({ url: e.SMS_API_URL, apiKey: e.SMS_API_KEY, sender: e.SMS_SENDER_NAME }) : new LogAdapter(e.SMS_PROVIDER, "SMS");
  return sms;
}

export function whatsappAdapter(): MessageAdapter {
  if (whatsapp) return whatsapp;
  const e = env();
  whatsapp = e.WHATSAPP_PROVIDER === "cloud" && e.WHATSAPP_TOKEN ? new WhatsAppCloudAdapter({ apiUrl: e.WHATSAPP_API_URL, phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID, token: e.WHATSAPP_TOKEN }) : new LogAdapter(e.WHATSAPP_PROVIDER, "WHATSAPP");
  return whatsapp;
}
