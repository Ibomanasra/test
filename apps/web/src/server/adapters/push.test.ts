import { describe, expect, it, vi } from "vitest";

vi.mock("@sa/db", () => ({ prisma: {} }));
vi.mock("../env", () => ({ env: () => ({ NODE_ENV: "test" }) }));
const { isExpoToken, sendExpoPush } = await import("./push");

describe("expo push", () => {
  it("validates tokens", () => {
    expect(isExpoToken("ExponentPushToken[abc-123]")).toBe(true);
    expect(isExpoToken("ExpoPushToken[xyz]")).toBe(true);
    expect(isExpoToken("<script>")).toBe(false);
  });

  it("sends in chunks of 100 and reports unregistered devices", async () => {
    const tokens = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[t${i}]`);
    const http = vi.fn(async (_u: string, init?: RequestInit) => {
      const batch = JSON.parse(String(init!.body)) as { to: string }[];
      return new Response(JSON.stringify({ data: batch.map((b) => (b.to === "ExponentPushToken[t120]" ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" })) }));
    });
    const invalid = await sendExpoPush(tokens, { title: "SO-1", body: "في الطريق" }, http as unknown as typeof fetch, "TOKEN");
    expect(http).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(http.mock.calls[0]![1]!.body))).toHaveLength(100);
    expect((http.mock.calls[0]![1]!.headers as Record<string, string>).authorization).toBe("Bearer TOKEN");
    expect(invalid).toEqual(["ExponentPushToken[t120]"]);
  });
});
