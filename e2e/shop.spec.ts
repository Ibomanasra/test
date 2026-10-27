import { expect, test, type Page } from "@playwright/test";
import { db, latestOtp, resetRateLimits } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

const B2C = { local: "0599100001", e164: "+970599100001" };
const B2B = { local: "0599100003", e164: "+970599100003" };

async function customerLogin(page: Page, who: { local: string; e164: string }) {
  await resetRateLimits();
  await page.goto("/ar/login");
  await page.locator("#phone").fill(who.local);
  const started = new Date(Date.now() - 1000);
  await page.locator("button[type=submit]").click();
  await page.locator("#code").fill(await latestOtp(who.e164, started));
  await page.locator("button[type=submit]").click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

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
  await page.goto("/ar/cart");
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await page.getByTestId("to-checkout").click();
  await expect(page).toHaveURL(/\/ar\/checkout$/);
  await page.getByTestId("pm-CASH_ON_DELIVERY").check();
  await expect(page.getByTestId("checkout-total")).toBeVisible();
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/ar\/account\/orders\/[^/?]+\?placed=1$/);
  await expect(page.getByTestId("status-timeline")).toBeVisible();

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
