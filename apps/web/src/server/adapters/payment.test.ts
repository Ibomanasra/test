import { describe, expect, it, vi } from "vitest";
import { ArabBankGateway, FakeGateway, GatewayError, PayTabsGateway, fromDecimal, hmacHex, toDecimal } from "./payment";

const session = {
  intentId: "pi_1",
  amount: 12_345,
  currency: "ILS" as const,
  description: "SO-2026-000001",
  locale: "ar" as const,
  customer: { name: "أحمد", phone: "+970599100001" },
  returnUrl: "https://shop.example/ar/pay/return?intent=pi_1",
  callbackUrl: "https://shop.example/api/v1/payments/callback/paytabs",
};

function mockFetch(responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const r = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe("amounts", () => {
  it("converts agorot to decimals and back", () => {
    expect(toDecimal(12_345)).toBe(123.45);
    expect(fromDecimal("123.45")).toBe(12_345);
    expect(fromDecimal(0.1)).toBe(10);
    expect(fromDecimal("x")).toBeNull();
  });
});

describe("fake gateway", () => {
  it("accepts only correctly signed callbacks", async () => {
    const g = new FakeGateway("secret", "http://localhost:3000");
    expect((await g.createSession(session)).redirectUrl).toBe("http://localhost:3000/ar/pay/fake/pi_1");
    const body = JSON.stringify({ intentId: "pi_1", approved: true, amount: 12_345 });
    const ok = await g.verifyCallback(body, new Headers({ "x-fake-signature": g.sign(body) }));
    expect(ok).toMatchObject({ intentId: "pi_1", status: "CAPTURED", amount: 12_345 });
    await expect(g.verifyCallback(body, new Headers({ "x-fake-signature": hmacHex("other", body) }))).rejects.toThrow(GatewayError);
    await expect(g.verifyCallback(body.replace("12345", "1"), new Headers({ "x-fake-signature": g.sign(body) }))).rejects.toThrow(GatewayError);
  });
});

describe("paytabs gateway", () => {
  it("creates a hosted payment page request", async () => {
    const m = mockFetch([{ body: { tran_ref: "TST123", redirect_url: "https://secure.paytabs.com/payment/page/abc" } }]);
    const g = new PayTabsGateway({ baseUrl: "https://secure.paytabs.com", profileId: "1001", serverKey: "SKEY" }, m.fn);
    expect(await g.createSession(session)).toEqual({ providerRef: "TST123", redirectUrl: "https://secure.paytabs.com/payment/page/abc" });
    expect(m.calls[0]!.url).toBe("https://secure.paytabs.com/payment/request");
    expect((m.calls[0]!.init!.headers as Record<string, string>).authorization).toBe("SKEY");
    const sent = JSON.parse(String(m.calls[0]!.init!.body));
    expect(sent).toMatchObject({ profile_id: 1001, cart_id: "pi_1", cart_currency: "ILS", cart_amount: 123.45, tran_type: "sale" });
  });

  it("verifies the HMAC signature of callbacks", async () => {
    const g = new PayTabsGateway({ baseUrl: "https://x", profileId: "1", serverKey: "SKEY" }, mockFetch([]).fn);
    const body = JSON.stringify({ tran_ref: "TST1", cart_id: "pi_1", cart_amount: "123.45", tran_total: "123.45", payment_result: { response_status: "A" } });
    expect(await g.verifyCallback(body, new Headers({ signature: hmacHex("SKEY", body) }))).toMatchObject({ intentId: "pi_1", status: "CAPTURED", amount: 12_345, providerRef: "TST1" });
    await expect(g.verifyCallback(body, new Headers({ signature: "00" }))).rejects.toThrow(GatewayError);
    expect(PayTabsGateway.parse({ cart_id: "x", payment_result: { response_status: "D" } }).status).toBe("FAILED");
    expect(PayTabsGateway.parse({ cart_id: "x", payment_result: { response_status: "H" } }).status).toBe("PENDING");
  });
});

describe("arab bank (MPGS)", () => {
  it("initiates hosted checkout and reads the order status", async () => {
    const m = mockFetch([
      { body: { session: { id: "SESSION0002" }, result: "SUCCESS" } },
      { body: { id: "pi_1", status: "CAPTURED", result: "SUCCESS", totalCapturedAmount: 123.45 } },
    ]);
    const g = new ArabBankGateway({ baseUrl: "https://ap-gateway.mastercard.com", merchantId: "TEST1", password: "pw", merchantName: "SA" }, m.fn);
    const s = await g.createSession(session);
    expect(s.redirectUrl).toBe("https://ap-gateway.mastercard.com/checkout/pay/SESSION0002");
    expect(m.calls[0]!.url).toBe("https://ap-gateway.mastercard.com/api/rest/version/72/merchant/TEST1/session");
    expect((m.calls[0]!.init!.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("merchant.TEST1:pw").toString("base64")}`);
    expect(JSON.parse(String(m.calls[0]!.init!.body)).order).toMatchObject({ id: "pi_1", amount: "123.45", currency: "ILS" });
    expect(await g.fetchStatus("pi_1")).toMatchObject({ status: "CAPTURED", amount: 12_345 });
    expect(ArabBankGateway.parseOrder("pi_1", { status: "DECLINED", result: "FAILURE" }).status).toBe("FAILED");
  });
});
