import { PrismaClient } from "@prisma/client";
import { expect, type Page } from "@playwright/test";

export const db = new PrismaClient();

/** Letzter OTP-Code für eine Nummer (SMS-Adapter "log" schreibt ihn ins NotificationLog). */
export async function latestOtp(phoneE164: string, after: Date): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const log = await db.notificationLog.findFirst({
      where: { to: phoneE164, template: "otp", createdAt: { gte: after } },
      orderBy: { createdAt: "desc" },
    });
    const code = (log?.payload as { text?: string } | null)?.text?.match(/\d{6}/)?.[0];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no OTP for ${phoneE164}`);
}

/** Eindeutige Testnummer pro Lauf (Jawwal-Präfix 059, 7 zufällige Ziffern). */
export function randomPhone(): { local: string; e164: string } {
  const rest = String(Math.floor(Math.random() * 9_000_000) + 1_000_000);
  return { local: `059${rest}`, e164: `+97059${rest}` };
}

export async function staffLogin(page: Page, phone: string, password: string, locale = "ar") {
  const e164 = `+970${phone.replace(/^0/, "")}`;
  await page.goto(`/${locale}/admin/login`);
  await page.locator("#phone").fill(phone);
  await page.locator("#password").fill(password);
  const started = new Date(Date.now() - 1000);
  await page.locator("button[type=submit]").click();
  await expect(page.locator("#code")).toBeVisible();
  await page.locator("#code").fill(await latestOtp(e164, started));
  await page.locator("button[type=submit]").click();
  // Login ist erst abgeschlossen, wenn die Weiterleitung erfolgt ist (Session-Cookie gesetzt)
  await page.waitForURL((url) => !url.pathname.endsWith("/admin/login"));
}

export const OWNER = { phone: process.env.E2E_OWNER_PHONE ?? "0599000001", password: process.env.E2E_OWNER_PASSWORD ?? "ChangeMe!2026" };
export const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Demo-2026-pass";
