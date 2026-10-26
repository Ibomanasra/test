import { describe, expect, it } from "vitest";
import {
  DOC_PREFIX,
  DOC_TYPES,
  GAPLESS_DOC_TYPES,
  NumberingError,
  businessDate,
  businessYear,
  findSequenceGaps,
  formatDocNumber,
  parseDocNumber,
  startOfBusinessDay,
} from "./numbering";

describe("formatDocNumber", () => {
  it("formats with year and padding", () => {
    expect(formatDocNumber({ prefix: "INV", year: 2026, seq: 123 })).toBe("INV-2026-000123");
    expect(formatDocNumber({ prefix: "DN", year: 2026, seq: 1 })).toBe("DN-2026-000001");
    expect(formatDocNumber({ prefix: "QT", year: 2027, seq: 42 }, 4)).toBe("QT-2027-0042");
  });

  it("grows instead of truncating when the counter exceeds the padding", () => {
    expect(formatDocNumber({ prefix: "INV", year: 2026, seq: 1_234_567 })).toBe("INV-2026-1234567");
  });

  it.each([
    [{ prefix: "inv", year: 2026, seq: 1 }],
    [{ prefix: "", year: 2026, seq: 1 }],
    [{ prefix: "INV", year: 99, seq: 1 }],
    [{ prefix: "INV", year: 2026, seq: 0 }],
    [{ prefix: "INV", year: 2026, seq: -1 }],
    [{ prefix: "INV", year: 2026, seq: 1.5 }],
  ])("rejects %o", (parts) => {
    expect(() => formatDocNumber(parts)).toThrow(NumberingError);
  });

  it("rejects invalid padding", () => {
    expect(() => formatDocNumber({ prefix: "INV", year: 2026, seq: 1 }, 0)).toThrow(NumberingError);
  });
});

describe("parseDocNumber", () => {
  it("round-trips", () => {
    for (const seq of [1, 99, 123_456, 9_999_999]) {
      const n = formatDocNumber({ prefix: "CN", year: 2026, seq });
      expect(parseDocNumber(n)).toEqual({ prefix: "CN", year: 2026, seq });
    }
  });

  it.each(["", "INV2026000123", "INV-26-000123", "INV-2026-", "INV-2026-000000", "inv-2026-1"])(
    "rejects %s",
    (value) => {
      expect(() => parseDocNumber(value)).toThrow(NumberingError);
    },
  );
});

describe("prefixes", () => {
  it("has a unique prefix for every doc type", () => {
    const prefixes = DOC_TYPES.map((t) => DOC_PREFIX[t]);
    expect(new Set(prefixes).size).toBe(DOC_TYPES.length);
  });

  it("marks only invoices and credit notes as gapless", () => {
    expect([...GAPLESS_DOC_TYPES].sort()).toEqual(["CREDIT_NOTE", "INVOICE"]);
  });
});

describe("business time zone", () => {
  it("uses Asia/Hebron for the year boundary", () => {
    // 31.12.2026 23:30 UTC = 01.01.2027 01:30 in Hebron (UTC+2)
    expect(businessYear(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
    expect(businessYear(new Date("2026-12-31T21:59:00Z"))).toBe(2026);
    expect(businessDate(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });

  it("handles summer time", () => {
    // Sommerzeit (UTC+3): 30.06. 21:30 UTC = 01.07. 00:30 lokal
    expect(businessDate(new Date("2026-06-30T21:30:00Z"))).toBe("2026-07-01");
  });
});

describe("findSequenceGaps", () => {
  it("finds no gaps in a complete sequence", () => {
    expect(findSequenceGaps([1, 2, 3, 4])).toEqual({ missing: [], duplicates: [] });
    expect(findSequenceGaps([])).toEqual({ missing: [], duplicates: [] });
  });

  it("finds missing and duplicate numbers (unsorted input)", () => {
    expect(findSequenceGaps([5, 1, 2, 2, 7])).toEqual({ missing: [3, 4, 6], duplicates: [2] });
  });

  it("detects a missing first number", () => {
    expect(findSequenceGaps([2, 3])).toEqual({ missing: [1], duplicates: [] });
  });
});

describe("startOfBusinessDay", () => {
  it("returns local midnight in winter (UTC+2) and summer (UTC+3)", () => {
    expect(startOfBusinessDay("2027-01-01").toISOString()).toBe("2026-12-31T22:00:00.000Z");
    expect(startOfBusinessDay("2026-07-15").toISOString()).toBe("2026-07-14T21:00:00.000Z");
    expect(businessDate(startOfBusinessDay("2026-10-26"))).toBe("2026-10-26");
  });

  it("round-trips with businessDate for every day of a year", () => {
    for (let d = new Date("2026-01-01T12:00:00Z"); d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 1)) {
      const ymd = d.toISOString().slice(0, 10);
      expect(businessDate(startOfBusinessDay(ymd))).toBe(ymd);
    }
  });

  it("rejects invalid input", () => {
    expect(() => startOfBusinessDay("2026-1-1")).toThrow(NumberingError);
  });
});
