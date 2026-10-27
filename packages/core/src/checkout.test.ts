import { describe, expect, it } from "vitest";
import { computeCheckout, creditAvailable, deliveryDates, fitsCreditLimit, lineFor } from "./checkout";

const RATE = { feeGrossAgorot: 1500, minOrderAgorot: 5000, freeFromAgorot: 30_000 };

describe("computeCheckout", () => {
  it("B2C: gross lines, delivery fee added, totals consistent", () => {
    const t = computeCheckout("B2C", [{ unitPrice: 1290, payableQtyBase: 5, taxRateBps: 1600 }], RATE, 1600);
    expect(t.goodsValue).toBe(6450);
    expect(t.deliveryFeeGross).toBe(1500);
    expect(t.gross).toBe(6450 + 1500);
    expect(t.net + t.vat).toBe(t.gross);
    expect(t.belowMinimum).toBe(false);
    expect(t.freeDelivery).toBe(false);
  });

  it("B2C: below minimum order value", () => {
    const t = computeCheckout("B2C", [{ unitPrice: 990, payableQtyBase: 2, taxRateBps: 1600 }], RATE, 1600);
    expect(t.belowMinimum).toBe(true);
    expect(t.minimumOrder).toBe(5000);
  });

  it("free delivery from threshold (inclusive)", () => {
    const t = computeCheckout("B2C", [{ unitPrice: 30_000, payableQtyBase: 1, taxRateBps: 1600 }], RATE, 1600);
    expect(t.freeDelivery).toBe(true);
    expect(t.deliveryFee).toBeNull();
    expect(t.gross).toBe(30_000);
  });

  it("B2B: net based, minimum and free threshold on net goods value", () => {
    const rate = { feeGrossAgorot: 2320, minOrderAgorot: 50_000, freeFromAgorot: 100_000 };
    const t = computeCheckout("B2B", [{ unitPrice: 850, payableQtyBase: 120, taxRateBps: 1600 }], rate, 1600);
    expect(t.goodsValue).toBe(102_000);
    expect(t.freeDelivery).toBe(true);
    expect(t.net).toBe(102_000);
    expect(t.vat).toBe(16_320);
    expect(t.gross).toBe(118_320);
  });

  it("B2B: fee line split from gross", () => {
    const rate = { feeGrossAgorot: 2320, minOrderAgorot: 0, freeFromAgorot: null };
    const t = computeCheckout("B2B", [{ unitPrice: 1000, payableQtyBase: 10, taxRateBps: 1600 }], rate, 1600);
    expect(t.deliveryFee).toEqual({ net: 2000, vat: 320, gross: 2320, rateBps: 1600 });
    expect(t.gross).toBe(11_600 + 2320);
  });

  it("empty cart is always below minimum; no zone means no fee", () => {
    expect(computeCheckout("B2C", [], RATE, 1600).belowMinimum).toBe(true);
    const t = computeCheckout("B2C", [{ unitPrice: 100, payableQtyBase: 1, taxRateBps: 1600 }], null, 1600);
    expect(t.deliveryFeeGross).toBe(0);
    expect(t.belowMinimum).toBe(false);
  });

  it("free units (payable qty) are not charged", () => {
    const l = lineFor("B2C", { unitPrice: 1690, payableQtyBase: 20, taxRateBps: 1600 });
    expect(l.gross).toBe(33_800);
  });
});

describe("credit limit", () => {
  it("computes availability and fit", () => {
    expect(creditAvailable(500_000, 120_000, 80_000)).toBe(300_000);
    expect(fitsCreditLimit(500_000, 120_000, 80_000, 300_000)).toBe(true);
    expect(fitsCreditLimit(500_000, 120_000, 80_000, 300_001)).toBe(false);
    expect(fitsCreditLimit(0, 0, 0, 1)).toBe(false);
  });
});

describe("deliveryDates", () => {
  it("starts tomorrow before cutoff and skips Friday by default", () => {
    // 2026-10-26 ist Montag
    expect(deliveryDates("2026-10-26", 10, [], 5)).toEqual(["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-31", "2026-11-01"]);
  });

  it("starts the day after tomorrow after cutoff", () => {
    expect(deliveryDates("2026-10-26", 15, [], 1)).toEqual(["2026-10-28"]);
  });

  it("respects configured weekdays", () => {
    // nur Sonntag (0) und Mittwoch (3)
    expect(deliveryDates("2026-10-26", 9, [0, 3], 3)).toEqual(["2026-10-28", "2026-11-01", "2026-11-04"]);
  });
});
