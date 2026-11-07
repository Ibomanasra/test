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

test("quick product: new category, prices, photo and stock in one step", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password, "en");
  await page.goto("/en/admin/products/new");
  const name = `Quick test ${Date.now()}`;
  await page.locator("#q-name").fill(name);
  await page.selectOption("#q-cat", "__new__");
  await page.locator("#q-newcat").fill("E2E Kategorie");
  await page.locator("#q-b2c").fill("9.90");
  await page.locator("#q-stock").fill("25");
  // 1×1-PNG als Foto
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.getByTestId("q-photos").setInputFiles({ name: "p.png", mimeType: "image/png", buffer: png });
  await page.getByTestId("q-save").click();
  await page.waitForURL((u) => /\/admin\/products\/(?!new)[a-z0-9]+$/.test(u.pathname));
  const p = await db.product.findFirstOrThrow({ where: { nameAr: name }, include: { variants: { include: { stockLevels: true } }, images: true, category: true } });
  expect(p.category.nameAr).toBe("E2E Kategorie");
  expect(p.variants[0]!.b2cPrice).toBe(990);
  expect(p.variants[0]!.b2bBasePrice).toBe(990);
  expect(p.variants[0]!.stockLevels.reduce((a, s) => a + s.onHand, 0)).toBe(25);
  expect(p.images).toHaveLength(1);
  expect(p.visibleB2C).toBe(true);
});

test("home page hero shows headline and offers link", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByTestId("hero")).toContainText("wholesale");
  await expect(page.getByTestId("hero").getByRole("link", { name: /Offers/ })).toBeVisible();
});

test("phone: admin menu closes after choosing an entry", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await staffLogin(page, OWNER.phone, OWNER.password, "en");
  await page.getByTestId("admin-menu").click();
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer.getByRole("link", { name: "Orders" })).toBeVisible();
  await drawer.getByRole("link", { name: "Orders" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/orders/);
  await expect(drawer.getByRole("link", { name: "Orders" })).toHaveCount(0);
  await ctx.close();
});

test("products: hide/show with one click, delete unused, archive used", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password, "en");
  // neues, unbenutztes Produkt über die Schnell-API
  const fd = { nameAr: `Delete me ${Date.now()}`, newCategoryAr: "E2E Kategorie", b2cPrice: "500" };
  const res = await page.request.post("/api/v1/admin/products/quick", { multipart: fd, headers: ORIGIN });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = await res.json();
  await page.goto(`/en/admin/products/${id}`);
  const sw = page.getByTestId("active-switch");
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await expect.poll(async () => (await db.product.findUniqueOrThrow({ where: { id } })).active).toBe(false);
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("delete-product").click();
  await page.waitForURL(/\/en\/admin\/products$/);
  expect(await db.product.findUnique({ where: { id } })).toBeNull();

  // bereits bestelltes Produkt → archiviert statt gelöscht
  const used = await db.product.findFirstOrThrow({ where: { variants: { some: { orderItems: { some: {} } } } } });
  const del = await (await page.request.delete(`/api/v1/admin/products/${used.id}`, { headers: ORIGIN })).json();
  expect(del.mode).toBe("archived");
  const after = await db.product.findUniqueOrThrow({ where: { id: used.id } });
  expect(after.archivedAt).not.toBeNull();
  // zurücksetzen
  await page.request.patch(`/api/v1/admin/products/${used.id}`, { data: { active: true }, headers: ORIGIN });
  expect((await db.product.findUniqueOrThrow({ where: { id: used.id } })).archivedAt).toBeNull();
});
