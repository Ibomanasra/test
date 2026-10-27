import { PrismaClient } from "@prisma/client";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

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

/** Tests melden sich oft an – Rate-Limit-Zähler vor jedem Login leeren (nur Testumgebung). */
export async function resetRateLimits() {
  await db.rateLimitBucket.deleteMany({});
}

export async function staffLogin(page: Page, phone: string, password: string, locale = "ar") {
  await resetRateLimits();
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

export const ORIGIN = { Origin: "http://localhost:3000" };

export async function customerLogin(page: Page, who: { local: string; e164: string }) {
  await resetRateLimits();
  await page.goto("/ar/login");
  await page.locator("#phone").fill(who.local);
  const started = new Date(Date.now() - 1000);
  await page.locator("button[type=submit]").click();
  await page.locator("#code").fill(await latestOtp(who.e164, started));
  await page.locator("button[type=submit]").click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

/** Frische B2C-Nachnahme-Bestellung über die echte API (wiederholbar); liefert die Bestell-ID */
export async function placeCodOrder(req: APIRequestContext, phoneE164: string, sku = "KI-001", qty = 2): Promise<string> {
  const customer = await db.customer.findFirstOrThrow({ where: { phone: phoneE164 } });
  await db.cartItem.deleteMany({ where: { cart: { customerId: customer.id } } });
  const v = await db.productVariant.findFirstOrThrow({ where: { sku } });
  await db.stockLevel.updateMany({ where: { variantId: v.id }, data: { onHand: { increment: qty + 5 } } });
  expect((await req.post("/api/v1/cart/items", { data: { variantId: v.id, unitCode: "PIECE", qty }, headers: ORIGIN })).ok()).toBe(true);
  const opts = await (await req.get("/api/v1/checkout")).json();
  const address = opts.addresses[0];
  const res = await req.post("/api/v1/orders", { data: { addressId: address.id, paymentMethod: "CASH_ON_DELIVERY", requestedDeliveryDate: address.deliveryDates[0] }, headers: ORIGIN });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()).id;
}

/** Bestellung als Mitarbeiter bis „Unterwegs“ bringen; liefert Lieferschein/Rechnung */
export async function dispatch(req: APIRequestContext, orderId: string): Promise<{ shipment: { id: string; number: string }; invoice: { id: string; number: string } }> {
  for (const to of ["CONFIRMED", "PICKING", "READY"]) expect((await req.post(`/api/v1/admin/orders/${orderId}/status`, { data: { to }, headers: ORIGIN })).ok()).toBe(true);
  const res = await req.post(`/api/v1/admin/orders/${orderId}/dispatch`, { data: { remainder: "CANCEL" }, headers: ORIGIN });
  expect(res.ok(), await res.text()).toBe(true);
  return res.json();
}
