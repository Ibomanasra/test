import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, ORIGIN, OWNER, customerLogin, db, dispatch, placeCodOrder, staffLogin } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

const B2C = { local: "0599100001", e164: "+970599100001" };
const DRIVER = { phone: "0599000005", e164: "+970599000005" };

test("purchase order → goods receipt raises stock and updates the cost price", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  const supplier = await db.supplier.findFirst({ where: { active: true } }) ?? (await (await page.request.post("/api/v1/admin/suppliers", { data: { name: "مورد اختبار" }, headers: ORIGIN })).json());
  const before = await db.productVariant.findUniqueOrThrow({ where: { sku: "PA-001" }, include: { stockLevels: true } });
  const po = await (await page.request.post("/api/v1/admin/purchase-orders", { data: { supplierId: supplier.id, items: [{ sku: "PA-001", unitCode: "CARTON", qty: 4, unitCost: before.costPrice * 5 + 500 }] }, headers: ORIGIN })).json();
  await page.goto(`/ar/admin/purchasing/${po.id}`);
  await page.getByTestId("po-order").click();
  await expect(page.getByTestId("receive-submit")).toBeVisible();
  await page.getByTestId("receive-submit").click();
  await expect(page.getByRole("status").filter({ hasText: /GR-\d{4}-\d{6}/ })).toBeVisible();
  const after = await db.productVariant.findUniqueOrThrow({ where: { sku: "PA-001" }, include: { stockLevels: true } });
  expect(after.stockLevels[0]!.onHand).toBe(before.stockLevels[0]!.onHand + 20);
  expect(after.costPrice).toBeGreaterThan(before.costPrice);
  expect(await db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, select: { status: true } })).toEqual({ status: "RECEIVED" });
  expect(await db.priceHistory.findFirst({ where: { variantId: after.id, source: "GOODS_RECEIPT" }, orderBy: { changedAt: "desc" } })).toMatchObject({ newPrice: after.costPrice });
});

test("driver delivers with cash on the phone and submits the cash closing", async ({ page, browser }) => {
  // Bestellung + Versand + Tour vorbereiten
  await customerLogin(page, B2C);
  const orderId = await placeCodOrder(page.request, B2C.e164, "BA-001", 3);
  const staff = await browser.newPage();
  await staffLogin(staff, OWNER.phone, OWNER.password);
  const { shipment, invoice } = await dispatch(staff.request, orderId);
  const driver = await db.user.findUniqueOrThrow({ where: { phone: DRIVER.e164 } });
  // Wiederholbarkeit: heutigen Kassenabschluss des Demo-Fahrers zurücksetzen
  const todays = await db.cashClosing.findMany({ where: { driverId: driver.id } });
  await db.cashCollection.updateMany({ where: { closingId: { in: todays.map((c) => c.id) } }, data: { closingId: null } });
  await db.cashClosing.deleteMany({ where: { id: { in: todays.map((c) => c.id) } } });
  const today = new Date().toISOString().slice(0, 10);
  const tour = await (await staff.request.post("/api/v1/admin/tours", { data: { date: today, driverId: driver.id, shipmentIds: [shipment.id] }, headers: ORIGIN })).json();
  expect(tour.number).toMatch(/^TR-/);
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });

  // Fahrer (Handy-Ansicht)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await ctx.newPage();
  await staffLogin(phone, DRIVER.phone, DEMO_PASSWORD);
  await expect(phone).toHaveURL(/\/driver/);
  const stop = phone.getByTestId("driver-stop").filter({ hasText: shipment.number });
  await stop.getByTestId("stop-deliver").click();
  await stop.locator("canvas").click({ position: { x: 30, y: 30 } });
  await stop.getByTestId("confirm-deliver").click();
  await expect(stop.getByTestId("confirm-deliver")).toHaveCount(0, { timeout: 15_000 });

  const paid = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  expect(paid.paidAmount).toBe(inv.totalGross);
  expect(paid.status).toBe("PAID");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  expect(order.status).toBe("DELIVERED");
  expect(order.paymentStatus).toBe("PAID");

  // Kassenabschluss: genau den Betrag zählen (in 10-Agorot-Münzen ist alles darstellbar)
  const open = await db.cashCollection.aggregate({ where: { driverId: driver.id, closingId: null }, _sum: { amount: true } });
  const expected = open._sum.amount ?? 0;
  const tens = expected % 1000;
  const ten = Math.floor((expected - tens) / 1000);
  await phone.getByLabel("10.00", { exact: true }).fill(String(ten));
  await phone.getByLabel("0.10", { exact: true }).fill(String(tens / 10));
  await phone.getByTestId("submit-closing").click();
  await expect(phone.getByRole("status").last()).toBeVisible();
  const closing = await db.cashClosing.findFirstOrThrow({ where: { driverId: driver.id }, orderBy: { date: "desc" } });
  expect(closing.status).toBe("SUBMITTED");
  expect(closing.difference).toBe(0);
  await ctx.close();
  await staff.close();
});

test("finance: payment allocates to the oldest invoice, stocktake posts differences, reports render", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  const open = await db.invoice.findFirst({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, orderBy: { dueDate: "asc" } });
  if (open) {
    const res = await (await page.request.post("/api/v1/admin/payments", { data: { customerId: open.customerId, method: "BANK_TRANSFER", amount: 100, reference: "E2E" }, headers: ORIGIN })).json();
    expect(res.number).toMatch(/^RC-/);
    const oldest = await db.invoice.findFirstOrThrow({ where: { customerId: open.customerId, OR: [{ status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, { id: res.allocations[0]?.invoiceId ?? "" }] }, orderBy: { dueDate: "asc" } });
    expect(res.allocations[0].invoiceId).toBe(oldest.id);
    expect((await page.request.post(`/api/v1/admin/payments/${res.id}/void`, { data: { reason: "E2E test" }, headers: ORIGIN })).ok()).toBe(true);
  }

  // Inventur über die Oberfläche
  await db.stocktake.updateMany({ where: { status: { in: ["OPEN", "COUNTING"] } }, data: { status: "CANCELLED" } });
  await page.goto("/ar/admin/stock/stocktakes");
  await page.locator("#new-stocktake-binPrefix").fill("B-");
  await page.getByTestId("new-stocktake-submit").click();
  await page.waitForURL(/\/admin\/stock\/stocktakes\/[^/]+$/);
  const first = page.getByTestId("count-row").first();
  const sku = (await first.locator("td").nth(1).innerText()).trim();
  const line = await db.stocktakeLine.findFirstOrThrow({ where: { variant: { sku }, stocktake: { status: { in: ["OPEN", "COUNTING"] } } } });
  await first.locator("input").fill(String(line.expectedQty + 1));
  await page.getByTestId("save-counts").click();
  await expect(page.getByText("✓")).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("close-stocktake").click();
  await expect(page.getByTestId("close-stocktake")).toHaveCount(0);
  const mv = await db.stockMovement.findFirstOrThrow({ where: { type: "STOCKTAKE", refId: line.stocktakeId } });
  expect(mv.qtyBase).toBe(1);

  // Berichte
  await page.goto("/ar/admin/reports?kind=channel&from=2026-01-01&to=2026-12-31");
  await expect(page.getByTestId("report-row").first()).toBeVisible();
  const pdf = await page.request.get("/api/v1/admin/reports?kind=category&format=pdf");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const xlsx = await page.request.get("/api/v1/admin/exports?kind=invoices&from=2026-01-01&to=2026-12-31&format=xlsx");
  expect(xlsx.status()).toBe(200);
});
