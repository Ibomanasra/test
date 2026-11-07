import { describe, expect, it } from "vitest";
import { checkOffer, distributeDiscount, nextThreshold, normalizeCouponCode, offerDiscountAmount, resolveOffers, type OfferRule } from "./offers";

const now = new Date("2026-11-07T10:00:00Z");
const rule = (o: Partial<OfferRule>): OfferRule => ({
  id: o.id ?? Math.random().toString(36),
  kind: "CART_THRESHOLD",
  channel: "BOTH",
  active: true,
  startsAt: null,
  endsAt: null,
  percentBps: null,
  amountAgorot: null,
  minOrderAgorot: 0,
  code: null,
  maxUses: null,
  perCustomerLimit: null,
  usedCount: 0,
  ...o,
});
const ctx = { channel: "B2C" as const, goodsValue: 40_000, now, firstOrder: false };

describe("offers", () => {
  it("checks period, channel, minimum and limits", () => {
    expect(checkOffer(rule({ active: false }), ctx)).toBe("inactive");
    expect(checkOffer(rule({ startsAt: new Date("2026-12-01") }), ctx)).toBe("not_started");
    expect(checkOffer(rule({ endsAt: now }), ctx)).toBe("ended");
    expect(checkOffer(rule({ channel: "B2B" }), ctx)).toBe("channel");
    expect(checkOffer(rule({ minOrderAgorot: 50_000 }), ctx)).toBe("min_order");
    expect(checkOffer(rule({ maxUses: 5, usedCount: 5 }), ctx)).toBe("used_up");
    expect(checkOffer(rule({ id: "x", perCustomerLimit: 1 }), { ...ctx, usesByCustomer: new Map([["x", 1]]) })).toBe("customer_limit");
    expect(checkOffer(rule({ kind: "WELCOME", percentBps: 1000 }), ctx)).toBe("not_first_order");
    expect(checkOffer(rule({ kind: "WELCOME", percentBps: 1000 }), { ...ctx, firstOrder: true })).toBeNull();
  });

  it("matches coupon codes case- and space-insensitively", () => {
    const c = rule({ kind: "COUPON", code: "RAMADAN10", percentBps: 1000 });
    expect(normalizeCouponCode(" ramadan 10 ")).toBe("RAMADAN10");
    expect(checkOffer(c, { ...ctx, couponCode: "ramadan10" })).toBeNull();
    expect(checkOffer(c, { ...ctx, couponCode: "OTHER" })).toBe("wrong_code");
    expect(checkOffer(c, ctx)).toBe("wrong_code");
  });

  it("computes percent and fixed discounts, capped at the goods value", () => {
    expect(offerDiscountAmount({ kind: "CART_THRESHOLD", percentBps: 500, amountAgorot: null }, 40_000)).toBe(2_000);
    expect(offerDiscountAmount({ kind: "COUPON", percentBps: null, amountAgorot: 5_000 }, 3_000)).toBe(3_000);
    expect(offerDiscountAmount({ kind: "FREE_DELIVERY", percentBps: 1000, amountAgorot: null }, 3_000)).toBe(0);
  });

  it("picks the single best goods discount and adds free delivery", () => {
    const a = rule({ id: "a", percentBps: 500 });
    const b = rule({ id: "b", kind: "WELCOME", amountAgorot: 3_000 });
    const f = rule({ id: "f", kind: "FREE_DELIVERY" });
    const r = resolveOffers([a, b, f], { ...ctx, firstOrder: true });
    expect(r.discount?.rule.id).toBe("b");
    expect(r.discount?.amount).toBe(3_000);
    expect(r.freeDelivery?.id).toBe("f");
  });

  it("reports coupon status", () => {
    const a = rule({ id: "a", percentBps: 1000 });
    const c = rule({ id: "c", kind: "COUPON", code: "X5", percentBps: 500 });
    expect(resolveOffers([a, c], { ...ctx, couponCode: "x5" }).coupon?.status).toBe("not_better");
    expect(resolveOffers([c], { ...ctx, couponCode: "x5" }).coupon?.status).toBe("applied");
    expect(resolveOffers([c], { ...ctx, couponCode: "nope" }).coupon).toEqual({ status: "invalid", reason: "wrong_code" });
    expect(resolveOffers([rule({ kind: "COUPON", code: "BIG", percentBps: 500, minOrderAgorot: 90_000 })], { ...ctx, couponCode: "big" }).coupon?.reason).toBe("min_order");
  });

  it("distributes a discount proportionally over unit prices", () => {
    const units = [{ unitPrice: 1_000, qty: 10 }, { unitPrice: 2_500, qty: 4 }]; // 20.000
    const next = distributeDiscount(units, 2_000); // 10 %
    expect(next).toEqual([900, 2_250]);
    expect(distributeDiscount(units, 0)).toEqual([1_000, 2_500]);
  });

  it("finds the next reachable threshold", () => {
    const t5 = rule({ id: "t5", percentBps: 500, minOrderAgorot: 50_000 });
    const t10 = rule({ id: "t10", percentBps: 1000, minOrderAgorot: 100_000 });
    expect(nextThreshold([t10, t5], ctx)).toEqual({ rule: t5, missing: 10_000 });
    expect(nextThreshold([t5], { ...ctx, goodsValue: 60_000 })).toBeNull();
  });
});
