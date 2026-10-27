import { describe, expect, it, vi } from "vitest";
import { ApiError, createApi } from "./api";
import { errorMessage, translator } from "./i18n";

describe("api client", () => {
  it("sends bearer token, locale and JSON body", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const api = createApi(fetchMock, "https://shop.example");
    await api("/api/v1/cart/items", { token: "tok", locale: "ar", body: { qty: 1 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://shop.example/api/v1/cart/items");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect((init?.headers as Record<string, string>)["Accept-Language"]).toBe("ar");
    expect(init?.body).toBe('{"qty":1}');
  });

  it("maps errors and network failures", async () => {
    const api = createApi(async () => new Response(JSON.stringify({ error: { code: "invalid_code" } }), { status: 400 }), "https://x");
    await expect(api("/a")).rejects.toMatchObject({ status: 400, body: { code: "invalid_code" } });
    const down = createApi(async () => {
      throw new TypeError("offline");
    }, "https://x");
    const err = await down("/a").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(errorMessage("ar", err)).toBe("تعذّر الاتصال بالخادم");
    expect(errorMessage("en", new ApiError(400, { code: "invalid_code" }))).toBe("Invalid code");
  });
});

describe("i18n", () => {
  it("translates and formats money with latin digits", () => {
    const ar = translator("ar");
    expect(ar.t("cart")).toBe("السلة");
    expect(ar.status("OUT_FOR_DELIVERY")).toBe("في الطريق");
    expect(ar.money(12_345)).toMatch(/123\.45/);
    expect(translator("en").pick({ nameAr: "سطل", nameEn: "Bucket" })).toBe("Bucket");
  });
});
