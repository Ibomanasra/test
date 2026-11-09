import { expect, test } from "@playwright/test";
import { OWNER, db, staffLogin } from "./helpers";

/** Besucherstatistik: anonyme Zählung im Shop (ohne Mitarbeiter/Bots) und Seite „الزوار“ */
const PHONE_UA = "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const IG_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0";

async function eventsFor(vid: string) {
  return db.visitEvent.findMany({ where: { vid }, orderBy: { id: "asc" } });
}

test("a visitor from an Instagram link is counted: entry with source, product view, search, add to cart", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: PHONE_UA });
  const page = await ctx.newPage();
  await page.goto("/ar?ref=instagram");
  await expect.poll(async () => (await ctx.cookies()).find((c) => c.name === "sa_vid")?.value ?? "").not.toBe("");
  const vid = (await ctx.cookies()).find((c) => c.name === "sa_vid")!.value;
  await page.locator('a[href*="/products/"]').first().click();
  await page.waitForURL(/\/products\/[^/?]+$/);
  await page.getByTestId("add-to-cart").first().click();
  await expect(page.getByTestId("added-toast")).toBeVisible();
  await page.goto("/ar/products?q=Seife");
  await expect.poll(async () => (await eventsFor(vid)).map((e) => e.type).join(",")).toContain("cart");
  await expect.poll(async () => (await eventsFor(vid)).some((e) => e.query === "seife")).toBe(true);
  const ev = await eventsFor(vid);
  expect(ev[0]).toMatchObject({ type: "view", path: "/", entry: true, source: "instagram", device: "mobile", locale: "ar", isNew: true });
  expect(ev.some((e) => e.type === "view" && e.slug)).toBe(true);
  // nur der erste Aufruf eines Besuchs ist ein Einstieg
  expect(ev.filter((e) => e.entry)).toHaveLength(1);
  await ctx.close();
});

test("in-app browsers are recognised without a ref; bots and staff are not counted", async ({ browser }) => {
  const ig = await browser.newContext({ userAgent: IG_UA });
  const p1 = await ig.newPage();
  await p1.goto("/ar");
  await expect.poll(async () => (await ig.cookies()).find((c) => c.name === "sa_vid")?.value ?? "").not.toBe("");
  const vid = (await ig.cookies()).find((c) => c.name === "sa_vid")!.value;
  await expect.poll(async () => (await eventsFor(vid))[0]?.source).toBe("instagram");
  await ig.close();

  // Suchmaschinen-Bot → kein Cookie, keine Zählung
  const bot = await browser.newContext({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
  const p2 = await bot.newPage();
  await p2.goto("/ar");
  await p2.waitForTimeout(1200);
  expect((await bot.cookies()).find((c) => c.name === "sa_vid")).toBeUndefined();
  await bot.close();

  // Mitarbeiter im Shop: keine Zählung
  const staff = await browser.newContext({ userAgent: PHONE_UA });
  const p3 = await staff.newPage();
  await staffLogin(p3, OWNER.phone, OWNER.password);
  await p3.goto("/ar/products");
  await p3.waitForTimeout(1200);
  expect((await staff.cookies()).find((c) => c.name === "sa_vid")).toBeUndefined();
  await staff.close();
});

test("visitors page shows KPIs, funnel, sources and top products", async ({ browser, page }) => {
  const ctx = await browser.newContext({ userAgent: PHONE_UA });
  const v = await ctx.newPage();
  await v.goto("/ar?utm_source=whatsapp");
  await v.locator('a[href*="/products/"]').first().click();
  await v.waitForURL(/\/products\/[^/?]+$/);
  await v.waitForTimeout(800);
  await ctx.close();

  await staffLogin(page, OWNER.phone, OWNER.password);
  await page.goto("/ar/admin/visitors?days=1");
  await expect(page.getByRole("heading", { name: "الزوار" })).toBeVisible();
  await expect(page.getByTestId("range-1")).toHaveAttribute("aria-selected", "true");
  const visitors = Number((await page.getByTestId("kpi-visitors").locator("p.text-3xl").innerText()).trim());
  expect(visitors).toBeGreaterThan(0);
  await expect(page.getByTestId("funnel")).toContainText("فتحوا صفحة منتج");
  await expect(page.getByTestId("sources")).toContainText("واتساب");
  await expect(page.getByTestId("top-products").locator("tbody tr").first()).toBeVisible();
  await expect(page.getByTestId("hours-chart")).toBeVisible();
  // 7-Tage-Ansicht mit Tagesdiagramm
  await page.getByTestId("range-7").click();
  await expect(page.getByTestId("visitors-chart")).toBeVisible();
  // Menüeintrag vorhanden
  await expect(page.locator('a[href$="/admin/visitors"]').first()).toBeAttached();
});
