import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { OWNER, db, latestOtp, resetRateLimits, staffLogin } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

const ORIGIN = { Origin: "http://localhost:3000" };
const B2C = { local: "0599100001", e164: "+970599100001" };
const OTHER = { local: "0569100002", e164: "+970569100002" };

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

/** Frische B2C-Bestellung über die echte API (wiederholbar) */
async function placeOrder(req: APIRequestContext): Promise<string> {
  const customer = await db.customer.findFirstOrThrow({ where: { phone: B2C.e164 } });
  await db.cartItem.deleteMany({ where: { cart: { customerId: customer.id } } });
  const v = await db.productVariant.findFirstOrThrow({ where: { sku: "KI-001" } });
  await db.stockLevel.updateMany({ where: { variantId: v.id }, data: { onHand: { increment: 5 } } });
  expect((await req.post("/api/v1/cart/items", { data: { variantId: v.id, unitCode: "PIECE", qty: 2 }, headers: ORIGIN })).ok()).toBe(true);
  const opts = await (await req.get("/api/v1/checkout")).json();
  const address = opts.addresses[0];
  const res = await req.post("/api/v1/orders", { data: { addressId: address.id, paymentMethod: "CASH_ON_DELIVERY", requestedDeliveryDate: address.deliveryDates[0] }, headers: ORIGIN });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()).id;
}

async function waitArchived(invoiceId: string) {
  for (let i = 0; i < 60; i++) {
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { archivedDoc: true } });
    if (inv.archivedDoc) return inv;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("invoice not archived");
}

test("dispatch issues a gapless invoice, freezes the PDF and restricts access", async ({ page, browser }) => {
  await customerLogin(page, B2C);
  const orderId = await placeOrder(page.request);

  const staff = await browser.newPage();
  await staffLogin(staff, OWNER.phone, OWNER.password);
  for (const to of ["CONFIRMED", "PICKING", "READY"]) {
    expect((await staff.request.post(`/api/v1/admin/orders/${orderId}/status`, { data: { to }, headers: ORIGIN })).ok()).toBe(true);
  }
  const before = await db.invoice.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const dispatched = await (await staff.request.post(`/api/v1/admin/orders/${orderId}/dispatch`, { data: { remainder: "CANCEL" }, headers: ORIGIN })).json();
  expect(dispatched.invoice.number).toMatch(/^INV-\d{4}-\d{6}$/);
  const seq = (n: string) => Number(n.split("-").pop());
  if (before) expect(seq(dispatched.invoice.number)).toBe(seq(before.number) + 1);

  // Eingefroren archiviert; Rechnung ist unveränderlich (DB-Trigger)
  const inv = await waitArchived(dispatched.invoice.id);
  expect(inv.archivedDoc!.frozen).toBe(true);
  await expect(db.invoice.update({ where: { id: inv.id }, data: { totalGross: 1 } })).rejects.toThrow(/immutable/);
  const ledger = await db.customerLedgerEntry.findFirst({ where: { refId: inv.id, type: "INVOICE" } });
  expect(ledger?.debit).toBe(inv.totalGross);

  // Kunde lädt seine Rechnung (Archiv-PDF), Fremdkunde und Gast nicht
  const own = await page.request.get(`/api/v1/documents/invoice/${inv.id}`);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toBe("application/pdf");
  expect((await own.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const guest = await browser.newContext();
  expect((await guest.request.get(`http://localhost:3000/api/v1/documents/invoice/${inv.id}`)).status()).toBe(401);
  const otherPage = await guest.newPage();
  await customerLogin(otherPage, OTHER);
  expect((await otherPage.request.get(`/api/v1/documents/invoice/${inv.id}`)).status()).toBe(403);
  await guest.close();

  // Admin: Lieferschein + Rechnung als ein PDF
  const batch = await staff.request.get(`/api/v1/print/batch?doc=delivery-note,invoice&ids=${orderId}`);
  expect(batch.status()).toBe(200);
  expect((await batch.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Teil-Gutschrift über die Oberfläche
  await staff.goto(`/ar/admin/documents/invoices/${inv.id}`);
  await staff.locator('input[type="number"]').first().fill("1");
  await staff.locator("#cn-reason").fill("بضاعة تالفة");
  staff.once("dialog", (d) => void d.accept());
  await staff.getByTestId("credit-selected").click();
  await expect(staff.getByRole("status").filter({ hasText: /CN-\d{4}-\d{6}/ })).toBeVisible();
  const after = await db.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: { creditNotes: true } });
  expect(after.creditNotes).toHaveLength(1);
  expect(after.creditedAmount).toBe(after.creditNotes[0]!.totalGross);
  expect(after.creditedAmount).toBeLessThan(after.totalGross);
  await staff.close();
});

test("invoice number format is locked once numbers were issued this year", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  const res = await page.request.put("/api/v1/admin/settings/sequences/INVOICE", { data: { prefix: "FAK", padding: 6 }, headers: ORIGIN });
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe("sequence_in_use");
});

test("any admin list prints as A4 PDF and the documents settings page loads", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  const res = await page.request.post("/api/v1/print/table", {
    data: { title: { ar: "قائمة", en: "List" }, columns: [{ key: "a", label: "A" }, { key: "b", label: "B", kind: "money" }], rows: [{ a: "x", b: 1290 }] },
    headers: ORIGIN,
  });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  await page.goto("/ar/admin/settings/documents");
  await expect(page.getByTestId("crud-row").first()).toBeVisible();
  await page.goto("/ar/admin/orders");
  await expect(page.getByTestId("print-table")).toBeVisible();
});
