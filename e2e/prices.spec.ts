import { expect, test } from "@playwright/test";
import { OWNER, db, staffLogin } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

test("price preview explains the B2C promotion price", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  await page.goto("/ar/admin/prices/preview");
  await page.locator("#p-sku").fill("CL-001");
  await page.locator("#p-qty").fill("1");
  await page.getByTestId("preview-calc").click();
  await expect(page.getByTestId("preview-result")).toBeVisible();
  // 12,90 − 10 % = 11,61 → Rundung auf ,90 → 11,90
  await expect(page.getByTestId("preview-price")).toContainText("11.90");
});

test("saving a price below minimum margin needs explicit confirmation and is logged", async ({ page }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  await page.goto("/en/admin/prices?q=PA-004");
  const row = page.getByTestId("crud-row").first();
  await row.getByRole("button", { name: "Edit" }).click();
  await page.locator("#f-b2bBasePrice").fill("4.00");
  await page.getByTestId("crud-save").click();
  await expect(page.getByTestId("confirm-below-margin")).toBeVisible();
  await page.getByTestId("confirm-below-margin").click();
  await expect(page.getByTestId("crud-save")).toHaveCount(0);
  const h = await db.priceHistory.findFirst({ where: { variant: { sku: "PA-004" }, field: "B2B_BASE" }, orderBy: { changedAt: "desc" } });
  expect(h?.newPrice).toBe(400);
  expect(h?.belowMarginConfirmed).toBe(true);
  // zurücksetzen
  await db.productVariant.update({ where: { sku: "PA-004" }, data: { b2bBasePrice: 720 } });
});

test("sales role can view but not edit prices", async ({ page }) => {
  await staffLogin(page, "0599000002", process.env.SEED_DEMO_PASSWORD ?? "Demo-2026-pass");
  const res = await page.request.put("/api/v1/admin/prices/variants/x", { data: { b2cPrice: 1 }, headers: { Origin: "http://localhost:3000" } });
  expect(res.status()).toBe(403);
  const list = await (await page.request.get("/api/v1/admin/prices/variants")).json();
  expect(list.items[0].costPrice).toBeUndefined();
});
