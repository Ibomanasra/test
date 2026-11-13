import { expect, test, type Page } from "@playwright/test";
import { ORIGIN, OWNER, customerLogin, db, randomPhone, staffLogin } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

const B2C = { local: "0599100001", e164: "+970599100001" };
const B2B = { local: "0599100003", e164: "+970599100003" };


/** Wiederholbare Läufe: genug freien Bestand für die Test-SKUs sicherstellen */
async function ensureStock(skus: string[], free = 500) {
  for (const sku of skus) {
    const levels = await db.stockLevel.findMany({ where: { variant: { sku } } });
    for (const l of levels) if (l.onHand - l.reserved < free) await db.stockLevel.update({ where: { variantId_warehouseId: { variantId: l.variantId, warehouseId: l.warehouseId } }, data: { onHand: l.reserved + free } });
  }
}

async function clearCart(phone: string) {
  const customer = await db.customer.findFirstOrThrow({ where: { phone } });
  await db.cartItem.deleteMany({ where: { cart: { customerId: customer.id } } });
}

/** Alle Preisfelder, die ein Gast/B2C-Kunde nie sehen darf (D12) */
async function b2bSecrets() {
  const v = await db.productVariant.findFirstOrThrow({ where: { sku: "CL-001" }, select: { b2bBasePrice: true, costPrice: true, product: { select: { slug: true } } } });
  const fmt = (a: number) => (a / 100).toFixed(2);
  return { slug: v.product.slug, values: [fmt(v.b2bBasePrice!), fmt(v.costPrice)] };
}

function assertNoB2B(body: string, values: string[]) {
  for (const key of ["b2bBasePrice", "costPrice", "\"tiers\"", "purchasePrice"]) expect(body, `leaked ${key}`).not.toContain(key);
  for (const v of values) expect(body, `leaked value ${v}`).not.toMatch(new RegExp(`(?<![\\d.,])${v.replace(".", "\\.")}(?!\\d)`));
}

test("B2B prices never reach guests or B2C customers (HTML and JSON)", async ({ page }) => {
  const { slug, values } = await b2bSecrets();
  // Gast
  for (const path of [`/ar/products/${slug}`, `/en/products/${slug}`, "/ar/products?q=CL-001"]) {
    const res = await page.request.get(path);
    expect(res.status()).toBe(200);
    assertNoB2B(await res.text(), values);
  }
  for (const path of [`/api/v1/catalog/${slug}`, "/api/v1/catalog?q=CL-001"]) assertNoB2B(await (await page.request.get(path)).text(), values);

  // B2C-Kunde (eingeloggt)
  await customerLogin(page, B2C);
  for (const path of [`/ar/products/${slug}`, `/api/v1/catalog/${slug}`, "/api/v1/catalog?q=CL"]) assertNoB2B(await (await page.request.get(path)).text(), values);

  // Gegenprobe: freigegebener Händler sieht Staffeln, aber nie den Einkaufspreis
  await page.context().clearCookies();
  await customerLogin(page, B2B);
  const dealer = await (await page.request.get(`/api/v1/catalog/${slug}`)).text();
  expect(dealer).toContain("\"tiers\"");
  expect(dealer).not.toContain("costPrice");
});

test("B2C customer orders with cash on delivery", async ({ page }) => {
  await clearCart(B2C.e164);
  await ensureStock(["CL-001"]);
  await customerLogin(page, B2C);
  const { slug } = await b2bSecrets();
  await page.goto(`/ar/products/${slug}`);
  await expect(page.getByTestId("add-to-cart").first()).toBeEnabled();
  await page.getByTestId("qty-input").first().fill("6");
  await page.getByTestId("add-to-cart").first().click();
  await expect(page.getByTestId("add-to-cart").first()).toHaveText(/✓/);
  // Zähler und Bestätigung sofort – ohne Neuladen
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await expect(page.getByTestId("added-toast")).toBeVisible();
  await page.getByTestId("toast-to-cart").click();
  await expect(page).toHaveURL(/\/ar\/cart$/);
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await page.getByTestId("to-checkout").click();
  await expect(page).toHaveURL(/\/ar\/checkout$/);
  await page.getByTestId("pm-CASH_ON_DELIVERY").check();
  await expect(page.getByTestId("checkout-total")).toBeVisible();
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/ar\/account\/orders\/[^/?]+\?placed=1$/);
  await expect(page.getByTestId("status-timeline")).toBeVisible();
  // Korb nach der Bestellung sofort leer (Kopfzeile ohne Neuladen)
  await expect(page.getByTestId("cart-count")).toHaveCount(0);

  const id = new URL(page.url()).pathname.split("/").pop()!;
  const order = await db.order.findUniqueOrThrow({ where: { id }, include: { items: { include: { reservations: true } } } });
  expect(order.channel).toBe("B2C");
  expect(order.paymentMethod).toBe("CASH_ON_DELIVERY");
  expect(order.status).toBe("NEW");
  expect(order.items[0]!.qtyBase).toBe(6);
  expect(order.items[0]!.reservations[0]?.status).toBe("ACTIVE");
});

test("B2B dealer quick-orders cartons and pays on account", async ({ page }) => {
  await clearCart(B2B.e164);
  // Wiederholbare Läufe: offene Testbestellungen sollen das Kreditlimit nicht ausschöpfen
  await db.customer.updateMany({ where: { phone: B2B.e164 }, data: { creditLimitAgorot: 1_000_000_000 } });
  await ensureStock(["CL-001", "PA-001"]);
  await customerLogin(page, B2B);
  await page.goto("/ar/account/quick-order");
  await expect(page.getByTestId("quick-submit")).toBeEnabled();
  await page.locator("#qo-text").fill("CL-001 5 CARTON\nPA-001 2 CARTON");
  await page.getByTestId("quick-submit").click();
  await expect(page.getByTestId("quick-result")).toBeVisible();
  await page.goto("/ar/cart");
  await expect(page.getByTestId("cart-line")).toHaveCount(2);
  await page.getByTestId("to-checkout").click();
  await page.getByTestId("pm-ON_ACCOUNT").check();
  await expect(page.getByTestId("place-order")).toBeEnabled();
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/ar\/account\/orders\/[^/?]+\?placed=1$/);

  const id = new URL(page.url()).pathname.split("/").pop()!;
  const order = await db.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
  expect(order.channel).toBe("B2B");
  expect(order.paymentMethod).toBe("ON_ACCOUNT");
  expect(order.paymentTermDays).toBe(30);
  expect(order.items.map((i) => i.qtyBase).sort((a, b) => a - b)).toEqual([10, 60]);
  // B2B: Positionen netto bepreist, Preisherkunft gespeichert
  expect(order.items.every((i) => i.priceRule && i.unitPriceNet > 0)).toBe(true);
});

test("stock: cannot add more than available, and a sale down to 10 % flags the low-stock alert", async ({ page, browser }) => {
  const staff = await browser.newPage();
  await staffLogin(staff, OWNER.phone, OWNER.password);
  const v = await db.productVariant.findFirstOrThrow({ where: { sku: "KI-001" }, include: { stockLevels: true } });
  const lvl = v.stockLevels[0]!;
  // automatischer Mindestbestand (Demo-Daten haben einen von Hand gesetzten Wert)
  await db.productVariant.update({ where: { id: v.id }, data: { minStockAuto: true, minStock: 0, lowStockAlertedAt: null } });
  // Ausgangslage: 99 verfügbar, dann +1 über die API → 100 (Auffüllung setzt die Schwelle auf 10 %)
  await db.stockLevel.update({ where: { variantId_warehouseId: { variantId: lvl.variantId, warehouseId: lvl.warehouseId } }, data: { onHand: lvl.reserved + 99 } });
  expect((await staff.request.post("/api/v1/admin/stock/adjust", { data: { sku: "KI-001", qtyBase: 1, reason: "E2E refill" }, headers: ORIGIN })).ok()).toBe(true);
  const after = await db.productVariant.findUniqueOrThrow({ where: { id: v.id } });
  expect(after.minStock).toBe(10);
  expect(after.lowStockAlertedAt).toBeNull();

  await clearCart(B2C.e164);
  await customerLogin(page, B2C);
  // mehr als verfügbar → abgelehnt
  const tooMuch = await page.request.post("/api/v1/cart/items", { data: { variantId: v.id, unitCode: "PIECE", qty: 101 }, headers: ORIGIN });
  expect(tooMuch.status()).toBe(400);
  expect((await tooMuch.json()).error.code).toBe("only_available");
  // 90 kaufen → 10 bleiben = 10 % → Warnung
  expect((await page.request.post("/api/v1/cart/items", { data: { variantId: v.id, unitCode: "PIECE", qty: 90 }, headers: ORIGIN })).ok()).toBe(true);
  const opts = await (await page.request.get("/api/v1/checkout")).json();
  const address = opts.addresses[0];
  const res = await page.request.post("/api/v1/orders", { data: { addressId: address.id, paymentMethod: "CASH_ON_DELIVERY", requestedDeliveryDate: address.deliveryDates[0] }, headers: ORIGIN });
  expect(res.ok(), await res.text()).toBe(true);
  await expect.poll(async () => (await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })).lowStockAlertedAt).not.toBeNull();
});

test("guests see the welcome banner and, after 3 products, the sign-up invite; 'later' hides it", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.getByTestId("guest-banner")).toBeVisible();
  const links = await page.locator('a[href*="/products/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))].slice(0, 3));
  for (const l of links) await page.goto(l);
  await expect(page.getByTestId("signup-invite")).toBeVisible();
  await page.getByTestId("invite-later").click();
  await expect(page.getByTestId("signup-invite")).toHaveCount(0);
  // eingeloggte Kunden sehen weder Streifen noch Fenster
  await customerLogin(page, B2C);
  await page.goto("/ar");
  await expect(page.getByTestId("guest-banner")).toHaveCount(0);
});

test("guest checkout: order without an account (name, phone, address), confirmation page via secret link", async ({ page }) => {
  await ensureStock(["CL-001"]);
  await page.context().addInitScript(() => { try { localStorage.setItem("sa-invite-dismissed", String(Date.now())); } catch {} });
  const v = await db.productVariant.findFirstOrThrow({ where: { sku: "CL-001" } });
  await page.goto("/ar/products");
  expect((await page.request.post("/api/v1/cart/items", { data: { variantId: v.id, unitCode: "PIECE", qty: 30 }, headers: ORIGIN })).ok()).toBe(true);
  await page.goto("/ar/cart");
  await page.getByTestId("to-checkout").click();
  await expect(page).toHaveURL(/\/ar\/checkout$/);
  await expect(page.getByTestId("guest-hint")).toBeVisible();

  const phone = randomPhone();
  await page.getByTestId("guest-name").fill("زبون بدون حساب");
  await page.getByTestId("guest-phone").fill(phone.local);
  await page.locator("#g-city").fill("الخليل");
  await page.locator("#g-street").fill("شارع السلام 5");
  await expect(page.getByTestId("checkout-total")).toBeVisible();
  await page.getByTestId("pm-CASH_ON_DELIVERY").check();
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/ar\/order\/[^/?]+\?k=/);
  await expect(page.getByTestId("order-placed")).toBeVisible();

  const id = new URL(page.url()).pathname.split("/").pop()!;
  const order = await db.order.findUniqueOrThrow({ where: { id }, include: { customer: { include: { members: true } } } });
  expect(order.customer.phone).toBe(phone.e164);
  expect(order.customer.members).toHaveLength(0);
  expect(order.placedById).toBeNull();
  expect((order.addressSnapshot as { city: string }).city).toBe("الخليل");
  // ohne gültigen Schlüssel kein Zugriff
  expect((await page.request.get(`/ar/order/${id}?k=falsch`)).status()).toBe(404);
});

test("guest checkout: a phone number that has an account must log in", async ({ page }) => {
  await ensureStock(["CL-001"]);
  const v = await db.productVariant.findFirstOrThrow({ where: { sku: "CL-001" } });
  await page.goto("/ar/products");
  expect((await page.request.post("/api/v1/cart/items", { data: { variantId: v.id, unitCode: "PIECE", qty: 30 }, headers: ORIGIN })).ok()).toBe(true);
  const opts = await (await page.request.post("/api/v1/checkout/guest", { data: { city: "الخليل" }, headers: ORIGIN })).json();
  const res = await page.request.post("/api/v1/orders/guest", { data: { name: "Test", phone: B2C.local, city: "الخليل", paymentMethod: "CASH_ON_DELIVERY", requestedDeliveryDate: opts.deliveryDates[0] }, headers: ORIGIN });
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe("phone_registered_login");
});

test("product photos swipe; back arrow returns to the same place in the list", async ({ page }) => {
  await page.context().addInitScript(() => { try { localStorage.setItem("sa-invite-dismissed", String(Date.now())); } catch {} });
  const p = await db.product.findFirstOrThrow({ where: { active: true, archivedAt: null, visibleB2C: true, images: { some: {} } }, include: { images: true } });
  const extra = await db.productImage.findFirstOrThrow({ where: { productId: { not: p.id } } });
  const added = await db.productImage.create({ data: { productId: p.id, fileId: extra.fileId, sortOrder: 99 } });
  try {
    await page.goto(`/ar/products/${p.slug}`);
    await expect(page.getByTestId("carousel-thumb")).toHaveCount(p.images.length + 1);
    await page.getByTestId("carousel-thumb").last().click();
    await expect.poll(() => page.getByTestId("image-carousel").first().evaluate((el) => Math.abs(el.scrollLeft))).toBeGreaterThan(0);

    await page.goto("/ar/products");
    const cards = page.getByTestId("product-card");
    const target = cards.nth(Math.min(7, (await cards.count()) - 1));
    await target.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => window.scrollY);
    await target.locator("h3").click();
    await page.getByTestId("back-button").click();
    await expect(page).toHaveURL(/\/ar\/products$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 50);
  } finally {
    await db.productImage.delete({ where: { id: added.id } });
  }
});

test("privacy policy: public page in all languages, linked in the footer and on sign-up", async ({ page }) => {
  await page.goto("/ar");
  await page.getByTestId("footer-privacy").click();
  await expect(page).toHaveURL(/\/ar\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("سياسة الخصوصية");
  await expect(page.getByTestId("privacy-page")).toContainText("لا نبيع ولا نؤجر");
  await expect(page.getByTestId("privacy-contact")).toBeVisible();
  await page.goto("/he/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("מדיניות פרטיות");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.goto("/en/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
  await page.goto("/ar/register");
  await expect(page.getByTestId("register-privacy").getByRole("link")).toHaveAttribute("href", "/ar/privacy");
});
