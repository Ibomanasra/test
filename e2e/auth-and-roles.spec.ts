import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, OWNER, db, latestOtp, randomPhone, staffLogin } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

test("owner logs in with password + OTP and sees the admin dashboard", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  await expect(page).toHaveURL(/\/ar\/admin$/);
  await expect(page.getByTestId("admin-user")).toBeVisible();
  await expect(page.getByTestId("tile-pending")).toBeVisible();
});

test("wrong staff password is rejected without sending an OTP", async ({ page }) => {
  await page.goto("/en/admin/login");
  await page.locator("#phone").fill(OWNER.phone);
  await page.locator("#password").fill("wrong-password-123");
  await page.locator("button[type=submit]").click();
  await expect(page.getByText("Wrong phone number or password.")).toBeVisible();
  await expect(page.locator("#code")).toHaveCount(0);
});

test("driver is redirected to the driver view and gets 403 on admin API", async ({ page }) => {
  await staffLogin(page, "0599000005", DEMO_PASSWORD);
  await expect(page).toHaveURL(/\/ar\/driver$/);
  const res = await page.request.get("/api/v1/admin/customers");
  expect(res.status()).toBe(403);
  await page.goto("/ar/admin/customers");
  await expect(page.getByTestId("forbidden")).toBeVisible();
});

test("anonymous requests to admin API get 401", async ({ request }) => {
  expect((await request.get("/api/v1/admin/customers")).status()).toBe(401);
  expect((await request.get("/api/v1/me")).status()).toBe(401);
});

test("B2C customer registers via OTP and is active immediately", async ({ page }) => {
  const phone = randomPhone();
  await page.goto("/ar/login");
  await page.locator("#phone").fill(phone.local);
  const started = new Date(Date.now() - 1000);
  await page.locator("button[type=submit]").click();
  await page.locator("#code").fill(await latestOtp(phone.e164, started));
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/ar\/register\?/);
  await page.locator("#name").fill("زبون اختبار");
  await page.locator("#zoneId").selectOption({ index: 1 });
  await page.locator("#city").fill("الخليل");
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(/\/ar\/account$/);
  await expect(page.getByTestId("customer-status")).toContainText("نشط");
  await expect(page.getByTestId("price-channel")).toContainText("أفراد");
});

test("B2B dealer registers with licence, waits for approval, then gets B2B channel", async ({ page, browser }) => {
  const phone = randomPhone();
  await page.goto("/ar/login?type=b2b");
  await page.locator("#phone").fill(phone.local);
  const started = new Date(Date.now() - 1000);
  await page.locator("button[type=submit]").click();
  await page.locator("#code").fill(await latestOtp(phone.e164, started));
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/ar\/register\?.*type=b2b/);

  const dealer = String(Math.floor(Math.random() * 900_000_000) + 100_000_000);
  await page.locator("#companyName").fill("متجر الاختبار");
  await page.locator("#ownerName").fill("مالك الاختبار");
  await page.locator("#dealerNumber").fill(dealer);
  await page.locator("#license").setInputFiles({ name: "license.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%test\n") });
  await page.locator("#zoneId").selectOption({ index: 2 });
  await page.locator("#city").fill("بيت لحم");
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(/\/ar\/account$/);
  await expect(page.getByTestId("customer-status")).toContainText("بانتظار الموافقة");
  // Bis zur Freigabe: B2C-Preise
  await expect(page.getByTestId("price-channel")).toContainText("أفراد");
  const me = await (await page.request.get("/api/v1/me")).json();
  expect(me.channel).toBe("B2C");

  // Admin gibt frei
  const admin = await browser.newPage();
  await staffLogin(admin, OWNER.phone, OWNER.password);
  await admin.goto(`/ar/admin/customers?q=${dealer}`);
  await admin.getByTestId("customer-row").first().locator("a").first().click();
  await expect(admin.getByTestId("license-link")).toBeVisible();
  await admin.locator("#credit").fill("2500");
  await admin.getByTestId("approve-button").click();
  await expect(admin.getByText("نشط").first()).toBeVisible();
  await admin.close();

  await page.reload();
  await expect(page.getByTestId("customer-status")).toContainText("نشط");
  await expect(page.getByTestId("price-channel")).toContainText("تجار");
  const me2 = await (await page.request.get("/api/v1/me")).json();
  expect(me2.channel).toBe("B2B");

  const customer = await db.customer.findFirstOrThrow({ where: { dealerNumber: dealer } });
  expect(customer.creditLimitAgorot).toBe(250_000);
  const log = await db.auditLog.findFirst({ where: { entityId: customer.id, action: "customer.approve" } });
  expect(log).not.toBeNull();
});

test("OTP requests are rate limited per phone", async ({ request }) => {
  const phone = randomPhone();
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    statuses.push((await request.post("/api/v1/auth/otp/request", { data: { phone: phone.local } })).status());
  }
  expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
  expect(statuses[3]).toBe(429);
});
