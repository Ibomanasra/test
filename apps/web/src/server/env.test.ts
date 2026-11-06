import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env", () => {
  it("treats empty values from .env.example as unset", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    vi.stubEnv("PAYMENT_GATEWAY_URL", "");
    vi.stubEnv("SMS_API_URL", "");
    vi.stubEnv("SMTP_PORT", "");
    const { env } = await import("./env");
    expect(env().PAYMENT_GATEWAY_URL).toBeUndefined();
    expect(env().SMTP_PORT).toBe(1025);
  });
});
