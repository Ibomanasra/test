import { createECDH, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ORIGIN, OWNER, customerLogin, db, placeCodOrder, staffLogin } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

const B2C = { local: "0599100001", e164: "+970599100001" };
const b64url = (b: Buffer) => b.toString("base64url");

test("web push: staff subscribes this browser, new orders still go through, unsubscribe removes it", async ({ page, browser }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  const { publicKey } = await (await page.request.get("/api/v1/me/web-push")).json();
  expect(publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);

  // Abo wie vom Browser (echter P-256-Schlüssel, nicht erreichbarer Push-Dienst)
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const endpoint = `https://push.invalid/e2e/${b64url(randomBytes(8))}`;
  const sub = { endpoint, keys: { p256dh: b64url(ecdh.getPublicKey()), auth: b64url(randomBytes(16)) } };
  expect((await page.request.post("/api/v1/me/web-push", { data: sub, headers: ORIGIN })).ok()).toBe(true);
  const owner = await db.user.findFirstOrThrow({ where: { username: OWNER.phone } });
  expect(await db.webPushSubscription.findUnique({ where: { endpoint } })).toMatchObject({ userId: owner.id });

  // Neue Bestellung löst den Versand aus – ein nicht erreichbarer Push-Dienst darf die Bestellung nie blockieren
  const shop = await browser.newPage();
  await customerLogin(shop, B2C);
  const orderId = await placeCodOrder(shop.request, B2C.e164, "BA-001", 3);
  expect(orderId).toBeTruthy();

  // Probe an die eigenen Geräte antwortet sauber
  expect((await page.request.post("/api/v1/me/web-push/test", { headers: ORIGIN })).ok()).toBe(true);

  // Abmelden
  expect((await page.request.delete(`/api/v1/me/web-push?endpoint=${encodeURIComponent(endpoint)}`, { headers: ORIGIN })).ok()).toBe(true);
  expect(await db.webPushSubscription.findUnique({ where: { endpoint } })).toBeNull();
});

test("web push: driver page offers notifications and the manifest opens the driver view", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "default" }));
  const phone = await ctx.newPage();
  await staffLogin(phone, "yousef", process.env.SEED_DEMO_PASSWORD ?? "Demo-2026-pass");
  await phone.goto("/ar/driver");
  await expect(phone.getByTestId("push-enable")).toBeVisible();
  const manifest = await (await phone.request.get("/api/v1/manifest/driver")).json();
  expect(manifest.start_url).toBe("/ar/driver");
  await ctx.close();
});
