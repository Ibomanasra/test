import { expect, test } from "@playwright/test";
import { ORIGIN, OWNER, customerLogin, db, dispatch, staffLogin } from "./helpers";

const B2C = { local: "0599100001", e164: "+970599100001" };

test.beforeAll(async () => {
  await db.paymentMethodConfig.updateMany({ where: { method: "CARD_GATEWAY", channel: "B2C" }, data: { enabled: true } });
});

test.afterAll(async () => {
  await db.paymentMethodConfig.updateMany({ where: { method: "CARD_GATEWAY", channel: "B2C" }, data: { enabled: false } });
  await db.$disconnect();
});

test("card payment via the gateway marks the order paid and the invoice is settled by a receipt", async ({ page, browser }) => {
  await customerLogin(page, B2C);
  const customer = await db.customer.findFirstOrThrow({ where: { phone: B2C.e164 } });
  await db.cartItem.deleteMany({ where: { cart: { customerId: customer.id } } });
  const v = await db.productVariant.findFirstOrThrow({ where: { sku: "KI-002" } });
  await db.stockLevel.updateMany({ where: { variantId: v.id }, data: { onHand: { increment: 5 } } });
  expect((await page.request.post("/api/v1/cart/items", { data: { variantId: v.id, unitCode: "PIECE", qty: 1 }, headers: ORIGIN })).ok()).toBe(true);

  await page.goto("/ar/checkout");
  await page.getByTestId("pm-CARD_GATEWAY").check();
  await expect(page.getByTestId("place-order")).toBeEnabled();
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/ar\/pay\/fake\//);
  await page.getByTestId("fake-approve").click();
  await page.waitForURL(/\/ar\/pay\/return\?intent=/);
  await expect(page.getByTestId("pay-result")).toHaveAttribute("data-status", "CAPTURED");

  const intentId = new URL(page.url()).searchParams.get("intent")!;
  const intent = await db.paymentIntent.findUniqueOrThrow({ where: { id: intentId }, include: { order: true } });
  expect(intent.status).toBe("CAPTURED");
  expect(intent.amount).toBe(intent.order.totalGross);
  expect(intent.order.paymentStatus).toBe("PAID");

  // Gefälschter Callback wird abgelehnt
  const anon = await browser.newContext();
  const forged = await anon.request.post("http://localhost:3000/api/v1/payments/callback/fake", { data: { intentId, approved: true, amount: 1 }, headers: { "x-fake-signature": "00" } });
  expect(forged.status()).toBe(401);
  await anon.close();

  // Versand → Rechnung bereits bezahlt, Quittung zugeordnet
  const staff = await browser.newPage();
  await staffLogin(staff, OWNER.phone, OWNER.password);
  const { invoice } = await dispatch(staff.request, intent.orderId);
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { allocations: { include: { payment: true } } } });
  expect(inv.status).toBe("PAID");
  expect(inv.paidAmount).toBe(inv.totalGross);
  expect(inv.allocations[0]?.payment.method).toBe("CARD_GATEWAY");
  expect((await db.paymentIntent.findUniqueOrThrow({ where: { id: intentId } })).paymentId).toBe(inv.allocations[0]!.paymentId);
  await staff.close();
});

test("declined card payment leaves the order unpaid with a retry option", async ({ page }) => {
  await customerLogin(page, B2C);
  const customer = await db.customer.findFirstOrThrow({ where: { phone: B2C.e164 } });
  await db.cartItem.deleteMany({ where: { cart: { customerId: customer.id } } });
  const v = await db.productVariant.findFirstOrThrow({ where: { sku: "KI-002" } });
  await db.stockLevel.updateMany({ where: { variantId: v.id }, data: { onHand: { increment: 5 } } });
  await page.request.post("/api/v1/cart/items", { data: { variantId: v.id, unitCode: "PIECE", qty: 1 }, headers: ORIGIN });
  await page.goto("/ar/checkout");
  await page.getByTestId("pm-CARD_GATEWAY").check();
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/ar\/pay\/fake\//);
  await page.getByTestId("fake-decline").click();
  await page.waitForURL(/\/ar\/pay\/return/);
  await expect(page.getByTestId("pay-result")).toHaveAttribute("data-status", "FAILED");
  await expect(page.getByTestId("pay-now")).toBeVisible();
  const intentId = new URL(page.url()).searchParams.get("intent")!;
  const intent = await db.paymentIntent.findUniqueOrThrow({ where: { id: intentId }, include: { order: true } });
  expect(intent.order.paymentStatus).toBe("UNPAID");
  expect(intent.order.status).toBe("NEW");
});
