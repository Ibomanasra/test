import { describe, expect, it } from "vitest";
import {
  MoneyError,
  allocate,
  applyDiscount,
  applyIncrease,
  assertAgorot,
  formatBps,
  formatMoney,
  normalizeDigits,
  parsePercentToBps,
  parseShekel,
  percentOf,
  roundDiv,
  sumAgorot,
} from "./money";

describe("roundDiv (half away from zero)", () => {
  it.each([
    [10, 4, 3], // 2.5 → 3
    [9, 4, 2], // 2.25 → 2
    [11, 4, 3], // 2.75 → 3
    [-10, 4, -3],
    [-9, 4, -2],
    [10, -4, -3],
    [0, 7, 0],
    [1, 2, 1], // 0.5 → 1
    [1, 3, 0],
    [2, 3, 1],
    [-1, 2, -1],
  ])("roundDiv(%i, %i) = %i", (n, d, expected) => {
    expect(roundDiv(n, d)).toBe(expected);
  });

  it("never returns -0", () => {
    expect(Object.is(roundDiv(-1, 3), 0)).toBe(true);
  });

  it("rejects division by zero and non-integers", () => {
    expect(() => roundDiv(1, 0)).toThrow(MoneyError);
    expect(() => roundDiv(1.5, 2)).toThrow(MoneyError);
  });

  it("is exact for large amounts", () => {
    // 50 Mio. ₪ × 16 %
    expect(roundDiv(5_000_000_000 * 1600, 10_000)).toBe(800_000_000);
  });
});

describe("percentOf / applyDiscount / applyIncrease", () => {
  it("computes percentages with half-up rounding", () => {
    expect(percentOf(1000, 1600)).toBe(160);
    expect(percentOf(1, 5000)).toBe(1); // 0.5 → 1
    expect(percentOf(1, 4999)).toBe(0);
    expect(percentOf(999, 1600)).toBe(160); // 159.84 → 160
  });

  it("applies discounts per unit", () => {
    expect(applyDiscount(1000, 500)).toBe(950);
    expect(applyDiscount(1099, 750)).toBe(1017); // 1016.575 → 1017
    expect(applyDiscount(1000, 0)).toBe(1000);
    expect(applyDiscount(1000, 10_000)).toBe(0);
  });

  it("applies increases and decreases", () => {
    expect(applyIncrease(1000, 1000)).toBe(1100);
    expect(applyIncrease(995, 350)).toBe(1030); // 1029.825 → 1030
    expect(applyIncrease(1000, -2500)).toBe(750);
  });

  it("validates bps range", () => {
    expect(() => applyDiscount(100, -1)).toThrow(MoneyError);
    expect(() => applyDiscount(100, 10_001)).toThrow(MoneyError);
    expect(() => percentOf(100, 12.5)).toThrow(MoneyError);
    expect(() => applyIncrease(100, -10_001)).toThrow(MoneyError);
  });

  it("rejects float amounts", () => {
    expect(() => applyDiscount(10.5, 100)).toThrow(MoneyError);
    expect(() => assertAgorot(Number.NaN)).toThrow(MoneyError);
    expect(() => assertAgorot(2 ** 53)).toThrow(MoneyError);
  });
});

describe("sumAgorot", () => {
  it("sums integers and validates", () => {
    expect(sumAgorot([1, 2, 3])).toBe(6);
    expect(sumAgorot([])).toBe(0);
    expect(() => sumAgorot([1, 0.1])).toThrow(MoneyError);
  });
});

describe("allocate", () => {
  it("splits exactly with largest remainder", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1, [1, 1])).toEqual([1, 0]);
    expect(allocate(1000, [3, 7])).toEqual([300, 700]);
  });

  it("keeps the sum for arbitrary weights", () => {
    const weights = [123, 456, 789, 1, 0, 42];
    for (const total of [0, 1, 7, 999, 100_003, -12_345]) {
      const parts = allocate(total, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      expect(parts[4]).toBe(0);
    }
  });

  it("handles negative totals symmetrically", () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });

  it("rejects invalid weights", () => {
    expect(() => allocate(10, [])).toThrow(MoneyError);
    expect(() => allocate(10, [0, 0])).toThrow(MoneyError);
    expect(() => allocate(10, [-1, 2])).toThrow(MoneyError);
  });
});

describe("parseShekel", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    ["12,50", 1250],
    ["0.01", 1],
    ["1,234.50", 123_450],
    ["1,234,567", 123_456_700],
    ["-3.10", -310],
    ["₪ 12.90", 1290],
    ["12.90 ILS", 1290],
    ["١٢٫٥٠", 1250],
    ["۱۲", 1200],
  ])("parseShekel(%s) = %i", (input, expected) => {
    expect(parseShekel(input)).toBe(expected);
  });

  it.each(["", "abc", "12.345", "1.2.3", "12,5,0", "--1"])("rejects %s", (input) => {
    expect(() => parseShekel(input)).toThrow(MoneyError);
  });
});

describe("formatMoney", () => {
  it("formats with latin digits and grouping", () => {
    expect(formatMoney(0)).toBe("0.00 ₪");
    expect(formatMoney(1)).toBe("0.01 ₪");
    expect(formatMoney(1290)).toBe("12.90 ₪");
    expect(formatMoney(123_456_789)).toBe("1,234,567.89 ₪");
    expect(formatMoney(-550)).toBe("-5.50 ₪");
  });

  it("supports options", () => {
    expect(formatMoney(123_456, { symbol: false })).toBe("1,234.56");
    expect(formatMoney(123_456, { grouping: false, symbol: false })).toBe("1234.56");
    expect(formatMoney(100, { signed: true })).toBe("+1.00 ₪");
    expect(formatMoney(0, { signed: true })).toBe("0.00 ₪");
  });

  it("round-trips with parseShekel", () => {
    for (const v of [0, 1, 99, 100, 12_345, 9_999_999]) {
      expect(parseShekel(formatMoney(v))).toBe(v);
    }
  });
});

describe("percent helpers", () => {
  it("formats bps", () => {
    expect(formatBps(1600)).toBe("16%");
    expect(formatBps(825)).toBe("8.25%");
    expect(formatBps(850)).toBe("8.5%");
    expect(formatBps(5)).toBe("0.05%");
    expect(formatBps(-500)).toBe("-5%");
  });

  it("parses percent", () => {
    expect(parsePercentToBps("16")).toBe(1600);
    expect(parsePercentToBps("8.25%")).toBe(825);
    expect(parsePercentToBps("8,5")).toBe(850);
    expect(parsePercentToBps("-5")).toBe(-500);
    expect(parsePercentToBps("١٦")).toBe(1600);
    expect(() => parsePercentToBps("abc")).toThrow(MoneyError);
    expect(() => parsePercentToBps("1.234")).toThrow(MoneyError);
  });
});

describe("normalizeDigits", () => {
  it("converts arabic-indic digits", () => {
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(normalizeDigits("abc 12")).toBe("abc 12");
  });
});
