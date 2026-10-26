import { expect, test } from "@playwright/test";

test.describe("i18n & RTL", () => {
  test("redirects to Arabic and renders RTL", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  });

  test("switches to English (LTR) and back", async ({ page }) => {
    await page.goto("/ar/login");
    await page.getByTestId("language-switcher").click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await page.getByTestId("language-switcher").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("uses latin digits in Arabic", async ({ page }) => {
    await page.goto("/ar");
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/[٠-٩]/);
  });

  test("health endpoint is up", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ status: "ok", db: "ok" });
  });
});
