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

/**
 * Entwicklungs-/Start-Adapter: schreibt die Nachricht nur ins NotificationLog
 * und in die Server-Konsole. Echte Anbieter (Jawwal, Ooredoo, Bulk-SMS) kommen
 * als weiterer Adapter mit derselben Schnittstelle (ROADMAP).
 */
class LogAdapter implements MessageAdapter {
  constructor(
    readonly name: string,
    private readonly channel: "SMS" | "WHATSAPP",
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
    await prisma.notificationLog.create({
      data: {
        channel: this.channel,
        to: message.to,
        template: message.template,
        locale: message.locale,
        // Codes landen bewusst im Log (nur Log-Adapter), damit Tests und Demo ohne SMS funktionieren.
        payload: { text: message.text, ...message.payload },
        status: "LOGGED",
        provider: this.name,
      },
    });
    if (env().NODE_ENV !== "test") {
      console.info(`[${this.channel}:${this.name}] → ${maskPhone(message.to)}: ${message.text}`);
    }
  }
}

let sms: MessageAdapter | undefined;
let whatsapp: MessageAdapter | undefined;

export function smsAdapter(): MessageAdapter {
  sms ??= new LogAdapter(env().SMS_PROVIDER, "SMS");
  return sms;
}

export function whatsappAdapter(): MessageAdapter {
  whatsapp ??= new LogAdapter(env().WHATSAPP_PROVIDER, "WHATSAPP");
  return whatsapp;
}
