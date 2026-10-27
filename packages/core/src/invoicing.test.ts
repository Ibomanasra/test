import { describe, expect, it } from "vitest";
import { InvoicingError, creditLine, deliveryFeeLine, documentTotals, dueDateFor, invoiceOpenAmount, invoiceStatusFor, shippedLine } from "./invoicing";

const item = { unitPriceNet: 950, unitPriceGross: 1102, vatRateBps: 1600, unitCode: "CARTON", unitFactor: 12, orderedQtyBase: 60, freeQtyBase: 0, shippedQtyBase: 60 };

describe("shippedLine", () => {
  it("prices B2B shipments net and keeps the carton unit when whole", () => {
    const l = shippedLine("B2B", item);
    expect(l).toMatchObject({ unitCode: "CARTON", qty: 5, qtyBase: 60, net: 57_000, vat: 9_120, gross: 66_120 });
  });

  it("falls back to pieces for partial cartons", () => {
    const l = shippedLine("B2B", { ...item, shippedQtyBase: 30 });
    expect(l).toMatchObject({ unitCode: "PIECE", unitFactor: 1, qty: 30, net: 28_500 });
  });

  it("prices B2C shipments from gross", () => {
    const l = shippedLine("B2C", { ...item, unitCode: "PIECE", unitFactor: 1, orderedQtyBase: 3, shippedQtyBase: 3, unitPriceGross: 1290 });
    expect(l.gross).toBe(3870);
    expect(l.net + l.vat).toBe(3870);
  });

  it("splits free goods proportionally", () => {
    // 10 bestellt, davon 2 gratis; 5 geliefert → 1 gratis
    const l = shippedLine("B2B", { ...item, unitCode: "PIECE", unitFactor: 1, orderedQtyBase: 10, freeQtyBase: 2, shippedQtyBase: 5 });
    expect(l.freeQtyBase).toBe(1);
    expect(l.payableQtyBase).toBe(4);
    expect(l.net).toBe(3800);
  });

  it("rejects impossible quantities", () => {
    expect(() => shippedLine("B2B", { ...item, shippedQtyBase: 0 })).toThrow(InvoicingError);
    expect(() => shippedLine("B2B", { ...item, shippedQtyBase: 61 })).toThrow(InvoicingError);
  });
});

describe("credit notes", () => {
  const src = { qtyBase: 3, lineNet: 3336, lineVat: 534, lineGross: 3870 };
  it("credits the full line exactly", () => {
    expect(creditLine(src, 3)).toMatchObject({ net: 3336, vat: 534, gross: 3870 });
  });
  it("credits partial quantities with consistent totals", () => {
    const l = creditLine(src, 1);
    expect(l.gross).toBe(1290);
    expect(l.net + l.vat).toBe(l.gross);
  });
  it("never credits more than invoiced", () => {
    expect(() => creditLine(src, 4)).toThrow(InvoicingError);
  });
});

describe("helpers", () => {
  it("delivery fee line from gross", () => {
    expect(deliveryFeeLine(0, 1600)).toBeNull();
    expect(deliveryFeeLine(1500, 1600)).toMatchObject({ gross: 1500, net: 1293, vat: 207 });
  });
  it("totals, due date, open amount and status", () => {
    expect(documentTotals([{ net: 1, vat: 2, gross: 3 }, { net: 10, vat: 1, gross: 11 }])).toEqual({ net: 11, vat: 3, gross: 14 });
    expect(dueDateFor(new Date("2026-10-27T10:00:00Z"), 30).toISOString()).toBe("2026-11-26T10:00:00.000Z");
    expect(invoiceOpenAmount({ totalGross: 100, paidAmount: 30, creditedAmount: 20 })).toBe(50);
    expect(invoiceStatusFor({ totalGross: 100, paidAmount: 0, creditedAmount: 100 })).toBe("CREDITED");
    expect(invoiceStatusFor({ totalGross: 100, paidAmount: 80, creditedAmount: 20 })).toBe("PAID");
    expect(invoiceStatusFor({ totalGross: 100, paidAmount: 10, creditedAmount: 0 })).toBe("PARTIALLY_PAID");
  });
});
