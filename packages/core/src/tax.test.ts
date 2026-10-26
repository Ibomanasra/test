import { describe, expect, it } from "vitest";
import {
  TaxError,
  assertNoOverlap,
  findOverlappingRates,
  grossToNet,
  lineFromGross,
  lineFromNet,
  netToGross,
  resolveTaxRate,
  sumTaxLines,
  vatFromNet,
  type TaxRateRecord,
} from "./tax";

const VAT = 1600;

describe("net/gross conversion", () => {
  it("adds 16 % VAT", () => {
    expect(vatFromNet(1000, VAT)).toBe(160);
    expect(netToGross(1000, VAT)).toBe(1160);
    expect(netToGross(0, VAT)).toBe(0);
    expect(netToGross(1, VAT)).toBe(1); // 0.16 → 0
    expect(netToGross(3, VAT)).toBe(3); // 0.48 → 0
    expect(netToGross(4, VAT)).toBe(5); // 0.64 → 1
  });

  it("extracts net from gross", () => {
    expect(grossToNet(1160, VAT)).toBe(1000);
    expect(grossToNet(1290, VAT)).toBe(1112); // 1112.07
    expect(grossToNet(1, VAT)).toBe(1); // 0.862 → 1
    expect(grossToNet(0, VAT)).toBe(0);
  });

  it("handles 0 % rate", () => {
    expect(netToGross(1234, 0)).toBe(1234);
    expect(grossToNet(1234, 0)).toBe(1234);
  });

  it("handles half-agora boundaries", () => {
    // 3125 × 0.16 = 500 exact; 3128 × 0.16 = 500.48 → 500; 3129 × 0.16 = 500.64 → 501
    expect(vatFromNet(3125, VAT)).toBe(500);
    expect(vatFromNet(3128, VAT)).toBe(500);
    expect(vatFromNet(3129, VAT)).toBe(501);
    // 1250 × 0.17 = 212.5 → 213 (half-up)
    expect(vatFromNet(1250, 1700)).toBe(213);
  });

  it("rejects invalid input", () => {
    expect(() => vatFromNet(10.5, VAT)).toThrow();
    expect(() => vatFromNet(10, 16)).not.toThrow();
    expect(() => vatFromNet(10, 10_001)).toThrow();
  });
});

describe("lineFromNet (B2B)", () => {
  it("rounds VAT per line after multiplying", () => {
    // 3 × 0.33 ₪ = 0.99 ₪ net → VAT 0.1584 → 0.16
    expect(lineFromNet(33, 3, VAT)).toEqual({ net: 99, vat: 16, gross: 115, rateBps: VAT });
  });

  it("works for carton quantities", () => {
    // 48 Stück à 8,50 ₪
    expect(lineFromNet(850, 48, VAT)).toEqual({ net: 40_800, vat: 6528, gross: 47_328, rateBps: VAT });
  });

  it("allows zero quantity, rejects negative/fractional", () => {
    expect(lineFromNet(850, 0, VAT)).toEqual({ net: 0, vat: 0, gross: 0, rateBps: VAT });
    expect(() => lineFromNet(850, -1, VAT)).toThrow(TaxError);
    expect(() => lineFromNet(850, 1.5, VAT)).toThrow(TaxError);
  });

  it("supports negative unit prices (credit lines)", () => {
    expect(lineFromNet(-1000, 2, VAT)).toEqual({ net: -2000, vat: -320, gross: -2320, rateBps: VAT });
  });
});

describe("lineFromGross (B2C)", () => {
  it("keeps the displayed gross exactly", () => {
    const l = lineFromGross(1290, 3, VAT);
    expect(l.gross).toBe(3870);
    expect(l.net).toBe(3336); // 3336.2
    expect(l.vat).toBe(534);
    expect(l.net + l.vat).toBe(l.gross);
  });

  it("splits a single agora", () => {
    expect(lineFromGross(1, 1, VAT)).toEqual({ net: 1, vat: 0, gross: 1, rateBps: VAT });
  });

  it("net + vat === gross for every price 0..10,000 agorot and many quantities", () => {
    for (let unit = 0; unit <= 10_000; unit += 7) {
      for (const qty of [1, 2, 3, 12, 99]) {
        const l = lineFromGross(unit, qty, VAT);
        expect(l.net + l.vat).toBe(l.gross);
        expect(l.vat).toBeGreaterThanOrEqual(0);
        // VAT never deviates more than half an agora from the exact value
        expect(Math.abs(l.vat - (l.gross * VAT) / (10_000 + VAT))).toBeLessThanOrEqual(0.5);
      }
    }
  });
});

describe("sumTaxLines", () => {
  it("sums rounded lines (not rounding the sum)", () => {
    // 3 lines each 0.33 net → line VAT 0.0528 → 0.05 ; total VAT 0.15, not round(0.99 × 0.16)=0.16
    const lines = [lineFromNet(33, 1, VAT), lineFromNet(33, 1, VAT), lineFromNet(33, 1, VAT)];
    const t = sumTaxLines(lines);
    expect(t.net).toBe(99);
    expect(t.vat).toBe(15);
    expect(t.gross).toBe(114);
  });

  it("produces a per-rate breakdown that adds up", () => {
    const lines = [
      lineFromNet(1000, 2, 1600),
      lineFromGross(1290, 1, 1600),
      lineFromNet(500, 1, 0),
      lineFromNet(777, 3, 1700),
    ];
    const t = sumTaxLines(lines);
    expect(t.breakdown.map((b) => b.rateBps)).toEqual([0, 1600, 1700]);
    expect(t.breakdown.reduce((a, b) => a + b.net, 0)).toBe(t.net);
    expect(t.breakdown.reduce((a, b) => a + b.vat, 0)).toBe(t.vat);
    expect(t.breakdown.reduce((a, b) => a + b.gross, 0)).toBe(t.gross);
    expect(t.net + t.vat).toBe(t.gross);
  });

  it("returns zeros for empty documents", () => {
    expect(sumTaxLines([])).toEqual({ net: 0, vat: 0, gross: 0, breakdown: [] });
  });

  it("rejects inconsistent lines", () => {
    expect(() => sumTaxLines([{ net: 100, vat: 16, gross: 117, rateBps: VAT }])).toThrow(TaxError);
  });

  it("mixed B2C order with delivery fee keeps gross exact", () => {
    const items = [lineFromGross(1990, 2, VAT), lineFromGross(590, 5, VAT), lineFromGross(2500, 1, VAT)];
    const fee = lineFromGross(1500, 1, VAT);
    const t = sumTaxLines([...items, fee]);
    expect(t.gross).toBe(1990 * 2 + 590 * 5 + 2500 + 1500);
    expect(t.net + t.vat).toBe(t.gross);
  });
});

describe("resolveTaxRate", () => {
  const rates: TaxRateRecord[] = [
    { code: "STANDARD", rateBps: 1600, validFrom: new Date("2020-01-01T00:00:00Z"), validTo: new Date("2027-01-01T00:00:00Z") },
    { code: "STANDARD", rateBps: 1700, validFrom: new Date("2027-01-01T00:00:00Z") },
    { code: "ZERO", rateBps: 0, validFrom: new Date("2020-01-01T00:00:00Z") },
  ];

  it("picks the rate valid at the date", () => {
    expect(resolveTaxRate(rates, new Date("2026-10-26T12:00:00Z")).rateBps).toBe(1600);
    expect(resolveTaxRate(rates, new Date("2026-12-31T23:59:59Z")).rateBps).toBe(1600);
    expect(resolveTaxRate(rates, new Date("2027-01-01T00:00:00Z")).rateBps).toBe(1700);
    expect(resolveTaxRate(rates, new Date("2030-01-01T00:00:00Z")).rateBps).toBe(1700);
    expect(resolveTaxRate(rates, new Date("2026-01-01T00:00:00Z"), "ZERO").rateBps).toBe(0);
  });

  it("throws when nothing is valid", () => {
    expect(() => resolveTaxRate(rates, new Date("2019-12-31T00:00:00Z"))).toThrow(TaxError);
    expect(() => resolveTaxRate(rates, new Date("2026-01-01T00:00:00Z"), "EXEMPT")).toThrow(TaxError);
  });

  it("detects overlapping validity ranges", () => {
    expect(findOverlappingRates(rates)).toHaveLength(0);
    expect(() => assertNoOverlap(rates)).not.toThrow();
    const bad = [...rates, { code: "STANDARD", rateBps: 1500, validFrom: new Date("2026-06-01T00:00:00Z") }];
    expect(findOverlappingRates(bad).length).toBeGreaterThan(0);
    expect(() => assertNoOverlap(bad)).toThrow(TaxError);
  });
});
