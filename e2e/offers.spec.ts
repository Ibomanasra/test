import { expect, test } from "@playwright/test";
import { OWNER, ORIGIN, customerLogin, db, staffLogin } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

const B2C = { local: "0599100001", e164: "+970599100001" };

test("admin creates a coupon in the offers center", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password, "en");
  await page.goto("/en/admin/offers");
  await page.getByTestId("new-COUPON").click();
  const code = `UI${Date.now().toString().slice(-6)}`;
  await page.locator("#o-code").fill(code);
  await page.getByTestId("o-percent").fill("10");
  await page.getByTestId("offer-save").click();
  await expect(page.getByTestId("offer-card").filter({ hasText: code })).toBeVisible();
  await db.orderOffer.deleteMany({ where: { code } });
});

test("customer redeems a coupon at checkout; cancelling frees it again", async ({ page, browser }) => {
  // Mitarbeiter legt einen einmaligen Gutschein an
  const staff = await browser.newPage();
  await staffLogin(staff, OWNER.phone, OWNER.password);
  const code = `E2E${Date.now().toString().slice(-6)}`;
  const created = await staff.request.post("/api/v1/admin/offers", { data: { kind: "COUPON", nameAr: "كوبون اختبار", nameEn: "Test coupon", channel: "B2C", percentBps: 1000, code, maxUses: 1 }, headers: ORIGIN });
  expect(created.ok(), await created.text()).toBe(true);
  const offer = await created.json();

  // Kunde: Warenkorb → Kasse → Gutschein
  const customer = await db.customer.findFirstOrThrow({ where: { phone: B2C.e164 } });
  await db.cartItem.deleteMany({ where: { cart: { customerId: customer.id } } });
  const v = await db.productVariant.findFirstOrThrow({ where: { sku: "KI-001" } });
  await db.stockLevel.updateMany({ where: { variantId: v.id }, data: { onHand: { increment: 10 } } });
  await customerLogin(page, B2C);
  expect((await page.request.post("/api/v1/cart/items", { data: { variantId: v.id, unitCode: "PIECE", qty: 3 }, headers: ORIGIN })).ok()).toBe(true);
  await page.goto("/en/checkout");
  await page.getByTestId("pm-CASH_ON_DELIVERY").check();
  await page.getByTestId("coupon-input").fill(code.toLowerCase());
  await page.getByTestId("coupon-apply").click();
  await expect(page.getByTestId("coupon-status")).toContainText("applied");
  await expect(page.getByTestId("offer-discount")).toBeVisible();
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/account\/orders\/[^/?]+\?placed=1$/);
  await expect(page.getByTestId("order-offer")).toBeVisible();

  const orderId = new URL(page.url()).pathname.split("/").pop()!;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  expect(order.offerId).toBe(offer.id);
  expect(order.couponCode).toBe(code);
  expect(order.offerDiscount).toBeGreaterThan(0);
  // Rabatt steckt in den Positionen: Summe der Positionen + Lieferung = Gesamt
  expect(order.items.reduce((a, i) => a + i.lineGross, 0) + order.deliveryFeeGross).toBe(order.totalGross);
  expect((await db.orderOffer.findUniqueOrThrow({ where: { id: offer.id } })).usedCount).toBe(1);

  // Zweite Einlösung scheitert (maxUses = 1)
  const preview = await page.request.post("/api/v1/checkout/preview", { data: { addressId: (await db.address.findFirstOrThrow({ where: { customerId: customer.id } })).id, couponCode: code }, headers: ORIGIN });
  expect((await preview.json()).coupon.status).toBe("invalid");

  // Storno gibt den Gutschein wieder frei
  expect((await staff.request.post(`/api/v1/admin/orders/${orderId}/cancel`, { data: { reason: "E2E Test" }, headers: ORIGIN })).ok()).toBe(true);
  expect((await db.orderOffer.findUniqueOrThrow({ where: { id: offer.id } })).usedCount).toBe(0);
  expect(await db.orderOfferRedemption.count({ where: { offerId: offer.id } })).toBe(0);

  await db.order.update({ where: { id: orderId }, data: { offerId: null } });
  await db.orderOffer.delete({ where: { id: offer.id } });
  await staff.close();
});

test("fixed offer price stays exact (10 ₪ = 10.00) and shows up in the offer product list", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  const fmt = (d: Date) => d.toISOString().slice(0, 16);
  const res = await page.request.post("/api/v1/admin/prices/rules/promotions", {
    data: { nameAr: "عشرة شيكل", nameEn: "Ten shekel", channel: "B2C", type: "FIXED_PRICE", startsAt: fmt(new Date(Date.now() - 3_600_000)), endsAt: fmt(new Date(Date.now() + 86_400_000)), targetSku: "CL-003", fixedPrice: 1000 },
    headers: ORIGIN,
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = await res.json();
  try {
    await page.goto("/en/admin/offers");
    const row = page.getByTestId("offer-product-row").filter({ hasText: "CL-003" }).filter({ hasText: "Ten shekel" });
    await expect(row.getByTestId("offer-price")).toContainText("10.00");
  } finally {
    await db.promotion.delete({ where: { id } });
  }
});

test("order page shows the goods price and the delivery cost separately", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  const o = await db.order.findFirstOrThrow({ orderBy: { placedAt: "desc" } });
  await page.goto(`/en/admin/orders/${o.id}`);
  await expect(page.getByTestId("order-goods")).toBeVisible();
  await expect(page.getByTestId("order-delivery")).toBeVisible();
  await page.goto(`/en/admin/orders?status=all&q=${o.number}`);
  await expect(page.getByTestId("row-split").first()).toContainText("Goods");
});
