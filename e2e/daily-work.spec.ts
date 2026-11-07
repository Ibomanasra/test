import { expect, test } from "@playwright/test";
import { OWNER, db, staffLogin } from "./helpers";

const ORIGIN = { Origin: "http://localhost:3000" };

test.afterAll(async () => {
  await db.$disconnect();
});

test("dashboard shows KPIs, chart and attention list", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  await page.goto("/en/admin");
  await expect(page.getByText("Sales, last 14 days")).toBeVisible();
  await expect(page.locator("svg[role=img]")).toBeVisible();
  await expect(page.getByTestId("tile-pending")).toBeVisible();
});

test("orders board: status tabs and one-click next step", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  await page.goto("/en/admin/orders?status=NEW");
  await expect(page.getByTestId("tab-NEW")).toHaveAttribute("aria-current", "page");
  const row = page.getByTestId("order-row").first();
  const number = (await row.locator("a").first().textContent())!.trim();
  await row.getByTestId("row-advance").click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { number } })).status).toBe("CONFIRMED");
});

test("admin edits customer master data and adds an address with a free city", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  const c = await db.customer.findFirstOrThrow({ where: { type: "B2B", isDemo: true }, orderBy: { number: "asc" } });
  await page.goto(`/en/admin/customers/${c.id}`);
  await page.getByTestId("edit-master").click();
  await page.locator("#m-email").fill("store@example.com");
  await page.getByTestId("save-master").click();
  await expect.poll(async () => (await db.customer.findUniqueOrThrow({ where: { id: c.id } })).email).toBe("store@example.com");

  // Ort ohne eigene Zone → Sammelzone „Other areas“
  const res = await page.request.post(`/api/v1/admin/customers/${c.id}/addresses`, { data: { recipient: "Branch", phone: "0599111222", city: "Kafr Ni'ma" }, headers: ORIGIN });
  expect(res.ok()).toBe(true);
  const a = await res.json();
  expect((await db.deliveryZone.findUniqueOrThrow({ where: { id: a.zoneId } })).code).toBe("OTHER");
  // bekannter Ort → passende Zone
  const res2 = await page.request.post(`/api/v1/admin/customers/${c.id}/addresses`, { data: { recipient: "Branch 2", phone: "0599111222", city: "البيرة" }, headers: ORIGIN });
  expect((await db.deliveryZone.findUniqueOrThrow({ where: { id: (await res2.json()).zoneId } })).code).toBe("RAMALLAH");

  await db.address.deleteMany({ where: { id: { in: [a.id, (await res2.json()).id] } } }).catch(() => undefined);
  await db.customer.update({ where: { id: c.id }, data: { email: c.email } });
});

test("VAT switch turns VAT on and off from now on", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  const put = (rateBps: number) => page.request.put("/api/v1/admin/settings/vat", { data: { rateBps }, headers: ORIGIN });
  expect((await put(1600)).ok()).toBe(true);
  await page.goto("/en/admin/prices");
  await expect(page.getByTestId("vat-pill")).toContainText("16");
  expect((await put(0)).ok()).toBe(true);
  await page.goto("/en/admin/prices");
  await expect(page.getByTestId("vat-pill")).toContainText("0%");
});

test("finance: record a payment in three steps and print the receipt", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  const inv = await db.invoice.findFirst({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, orderBy: { dueDate: "asc" } });
  test.skip(!inv, "no open invoice in the demo data");
  await page.goto("/en/admin/finance");
  await expect(page.getByText("What do you want to do?")).toBeVisible();
  await page.goto(`/en/admin/finance/payments?customer=${inv!.customerId}`);
  await page.locator("[data-testid=pay-wizard] input[type=checkbox]").first().check();
  await page.getByTestId("pay-amount").fill("1.00");
  await page.getByTestId("pay-submit").click();
  await expect(page.getByTestId("pay-done")).toBeVisible();
  const p = await db.payment.findFirstOrThrow({ where: { customerId: inv!.customerId, amount: 100 }, orderBy: { receivedAt: "desc" }, include: { allocations: true } });
  expect(p.allocations).toHaveLength(1);
  expect((await page.request.post(`/api/v1/admin/payments/${p.id}/void`, { data: { reason: "E2E test" }, headers: ORIGIN })).ok()).toBe(true);
});
