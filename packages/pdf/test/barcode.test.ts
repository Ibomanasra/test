import { describe, expect, it } from "vitest";
import { BarcodeError, CODE128_PATTERNS, code128Svg, code128Values } from "../src/barcode";

describe("code128", () => {
  it("has 107 well-formed patterns (11 modules, stop 13)", () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    CODE128_PATTERNS.forEach((p, i) => {
      const sum = [...p].reduce((a, c) => a + Number(c), 0);
      expect(sum, `pattern ${i}`).toBe(i === 106 ? 13 : 11);
    });
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
  });

  it("computes the mod-103 checksum", () => {
    // Start B (104) + "AB": A=33, B=34 → (104 + 33·1 + 34·2) % 103 = 102
    expect(code128Values("AB")).toEqual([104, 33, 34, 102, 106]);
  });

  it("renders an SVG and rejects unsupported characters", () => {
    const svg = code128Svg("CL-001");
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("CL-001");
    expect(() => code128Values("سلام")).toThrow(BarcodeError);
    expect(() => code128Values("")).toThrow(BarcodeError);
  });
});
