import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-Tests gegen eine laufende Instanz (Standard http://localhost:3000, z. B. `docker compose up`).
 * OTP-Codes werden aus dem NotificationLog gelesen (SMS-Adapter "log") → DATABASE_URL muss gesetzt sein.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /smoke\.spec\.ts/ },
  ],
});
