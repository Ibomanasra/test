import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";

/** E-Mail per SMTP (Entwicklung: Mailpit unter http://localhost:8025) */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transport: Transporter | undefined;

function transporter(): Transporter {
  if (transport) return transport;
  const e = env();
  transport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

export async function sendMail(m: MailMessage): Promise<void> {
  await transporter().sendMail({ from: env().SMTP_FROM, to: m.to, subject: m.subject, text: m.text, html: m.html });
}
