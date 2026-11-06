import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, ORIGIN, OWNER, customerLogin, db, dispatch, latestOtp, placeCodOrder, resetRateLimits, staffLogin } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
const ACCOUNTING = { phone: "0599000006", e164: "+970599000006", email: "accounting@sholat-aljanoub.local" };

async function resetLink(after: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/messages`)).json()) as { messages: { ID: string; To: { Address: string }[]; Created: string }[] };
    const m = list.messages.find((x) => x.To.some((t) => t.Address === ACCOUNTING.email) && Date.parse(x.Created) >= after);
    if (m) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as { Text: string };
      const link = full.Text.match(/https?:\/\/\S+reset-password\?token=\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no reset mail");
}

async function resetPassword(page: import("@playwright/test").Page, newPassword: string) {
  await resetRateLimits();
  const started = Date.now() - 2000;
  await page.goto("/ar/admin/login");
  await page.getByTestId("forgot-password").click();
  await page.locator("#identifier").fill(ACCOUNTING.phone);
  await page.getByTestId("reset-request").click();
  await expect(page.getByRole("status")).toBeVisible();
  const link = new URL(await resetLink(started));
  await page.goto(link.pathname + link.search);
  await page.locator("#password").fill(newPassword);
  await page.locator("#password2").fill(newPassword);
  await page.getByTestId("reset-confirm").click();
  await expect(page.getByRole("status")).toBeVisible();
  return link;
}

test("staff resets the password by email; the link works only once", async ({ page }) => {
  await db.user.update({ where: { phone: ACCOUNTING.e164 }, data: { email: ACCOUNTING.email } });
  const link = await resetPassword(page, "NeuesPasswort2026");
  // Link erneut verwenden → ungültig
  await page.goto(link.pathname + link.search);
  await page.locator("#password").fill("NochEinmal2026x");
  await page.locator("#password2").fill("NochEinmal2026x");
  await page.getByTestId("reset-confirm").click();
  await expect(page.getByRole("alert")).toBeVisible();
  // Anmeldung mit neuem Passwort
  await staffLogin(page, ACCOUNTING.phone, "NeuesPasswort2026");
  await expect(page).toHaveURL(/\/admin/);
  // zurücksetzen auf das Demo-Passwort
  await page.context().clearCookies();
  await resetPassword(page, DEMO_PASSWORD);
});

test("unknown accounts get the same answer (no enumeration)", async ({ request }) => {
  await resetRateLimits();
  const res = await request.post("/api/v1/auth/staff/password-reset/request", { data: { identifier: "0599999999" } });
  expect(await res.json()).toEqual({ ok: true });
});

test("driver app delivery stores a server-built SVG signature and a photo as proof", async ({ page, browser }) => {
  await customerLogin(page, { local: "0599100001", e164: "+970599100001" });
  const orderId = await placeCodOrder(page.request, "+970599100001", "BA-001", 3);
  const staff = await browser.newPage();
  await staffLogin(staff, OWNER.phone, OWNER.password);
  const { shipment } = await dispatch(staff.request, orderId);
  const driver = await db.user.findUniqueOrThrow({ where: { phone: "+970599000005" } });
  await staff.request.post("/api/v1/admin/tours", { data: { date: new Date().toISOString().slice(0, 10), driverId: driver.id, shipmentIds: [shipment.id] }, headers: ORIGIN });
  const stop = await db.tourStop.findUniqueOrThrow({ where: { shipmentId: shipment.id } });

  // Fahrer meldet sich wie die App an (Bearer-Token)
  await resetRateLimits();
  const ctx = await browser.newContext();
  const login = await (await ctx.request.post("http://localhost:3000/api/v1/auth/staff/login", { data: { phone: "0599000005", password: DEMO_PASSWORD } })).json();
  const started = new Date(Date.now() - 1000);
  const code = await latestOtp("+970599000005", started).catch(async () => latestOtp("+970599000005", new Date(0)));
  const { token } = await (await ctx.request.post("http://localhost:3000/api/v1/auth/staff/verify", { data: { ticket: login.ticket, code, client: "MOBILE" } })).json();
  const auth = { Authorization: `Bearer ${token}` };

  // Push-Token registrieren (gültig/ungültig)
  expect((await ctx.request.post("http://localhost:3000/api/v1/me/push-token", { data: { token: "ExponentPushToken[e2e-device]", platform: "android" }, headers: auth })).ok()).toBe(true);
  expect((await ctx.request.post("http://localhost:3000/api/v1/me/push-token", { data: { token: "<script>alert(1)</script>", platform: "android" }, headers: auth })).status()).toBe(400);

  // Manipulierte Unterschrift wird abgelehnt
  const bad = await ctx.request.post(`http://localhost:3000/api/v1/driver/stops/${stop.id}/deliver`, { data: { signaturePaths: ['M10 10"/><script>alert(1)</script>'] }, headers: auth });
  expect(bad.status()).toBe(400);

  const jpeg = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex").toString("base64");
  const ok = await ctx.request.post(`http://localhost:3000/api/v1/driver/stops/${stop.id}/deliver`, {
    data: { receivedByName: "أحمد", cashAmount: stop.codExpected, signaturePaths: ["M100 200 L300 250 L500 180", "M600 100 L700 300"], photo: `data:image/jpeg;base64,${jpeg}` },
    headers: auth,
  });
  expect(ok.ok(), await ok.text()).toBe(true);
  const s = await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
  expect(s.signatureFileId).toBeTruthy();
  expect(s.photoFileId).toBeTruthy();

  // Admin sieht die Nachweise; SVG wird mit Sandbox-CSP ausgeliefert
  await staff.goto(`/ar/admin/orders/${orderId}`);
  await expect(staff.getByTestId("proof-signature")).toBeVisible();
  const svg = await staff.request.get(`/api/v1/files/${s.signatureFileId}`);
  expect(svg.headers()["content-type"]).toBe("image/svg+xml");
  expect(svg.headers()["content-security-policy"]).toContain("sandbox");
  expect(await svg.text()).toMatch(/^<svg[^>]*><path d="M100 200 L300 250 L500 180 M600 100 L700 300"/);
  // Fremder Kunde sieht den Nachweis nicht
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await customerLogin(otherPage, { local: "0569100002", e164: "+970569100002" });
  expect((await otherPage.request.get(`/api/v1/files/${s.signatureFileId}`)).status()).toBe(403);
  await other.close();
  await db.pushToken.deleteMany({ where: { token: "ExponentPushToken[e2e-device]" } });
  await ctx.close();
  await staff.close();
});

test("a cancelled card order is refunded through the gateway", async ({ page, browser }) => {
  await db.paymentMethodConfig.updateMany({ where: { method: "CARD_GATEWAY", channel: "B2C" }, data: { enabled: true } });
  try {
    await customerLogin(page, { local: "0599100001", e164: "+970599100001" });
    const customer = await db.customer.findFirstOrThrow({ where: { phone: "+970599100001" } });
    await db.cartItem.deleteMany({ where: { cart: { customerId: customer.id } } });
    const v = await db.productVariant.findFirstOrThrow({ where: { sku: "KI-002" } });
    await db.stockLevel.updateMany({ where: { variantId: v.id }, data: { onHand: { increment: 5 } } });
    await page.request.post("/api/v1/cart/items", { data: { variantId: v.id, unitCode: "PIECE", qty: 1 }, headers: ORIGIN });
    await page.goto("/ar/checkout");
    await page.getByTestId("pm-CARD_GATEWAY").check();
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/ar\/pay\/fake\//);
    await page.getByTestId("fake-approve").click();
    await page.waitForURL(/\/ar\/pay\/return/);
    const intentId = new URL(page.url()).searchParams.get("intent")!;
    const intent = await db.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });

    const staff = await browser.newPage();
    await staffLogin(staff, OWNER.phone, OWNER.password);
    expect((await staff.request.post(`/api/v1/admin/orders/${intent.orderId}/cancel`, { data: { reason: "طلب العميل" }, headers: ORIGIN })).ok()).toBe(true);
    await staff.goto(`/ar/admin/orders/${intent.orderId}`);
    staff.once("dialog", (d) => void d.accept());
    await staff.getByTestId("refund-card").click();
    await expect(staff.getByTestId("refund-card")).toHaveCount(0);
    const after = await db.paymentIntent.findUniqueOrThrow({ where: { id: intentId }, include: { order: true } });
    expect(after.status).toBe("REFUNDED");
    expect(after.order.paymentStatus).toBe("REFUNDED");
    await staff.close();
  } finally {
    await db.paymentMethodConfig.updateMany({ where: { method: "CARD_GATEWAY", channel: "B2C" }, data: { enabled: false } });
  }
});
