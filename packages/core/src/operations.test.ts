import { describe, expect, it } from "vitest";
import { OperationsError, agingBucket, agingSummary, allocatePayment, cashDifference, newCostPrice, nextDunningLevel, purchaseStatusFor, stocktakeVariance, sumDenominations } from "./operations";

const d = (s: string) => new Date(`${s}T10:00:00Z`);

describe("goods receipt cost", () => {
  it("uses the last price or a weighted average", () => {
    expect(newCostPrice("LAST", 100, 650, 50, 700)).toBe(700);
    // (100·650 + 50·700) / 150 = 666.67 → 667
    expect(newCostPrice("WEIGHTED_AVG", 100, 650, 50, 700)).toBe(667);
    expect(newCostPrice("WEIGHTED_AVG", 0, 650, 50, 700)).toBe(700);
    expect(newCostPrice("WEIGHTED_AVG", -5, 650, 50, 700)).toBe(700);
    expect(() => newCostPrice("LAST", 1, 1, 0, 1)).toThrow(OperationsError);
  });
  it("derives the purchase order status", () => {
    expect(purchaseStatusFor([{ orderedBase: 10, receivedBase: 0 }])).toBe("ORDERED");
    expect(purchaseStatusFor([{ orderedBase: 10, receivedBase: 4 }, { orderedBase: 5, receivedBase: 0 }])).toBe("PARTIALLY_RECEIVED");
    expect(purchaseStatusFor([{ orderedBase: 10, receivedBase: 10 }, { orderedBase: 5, receivedBase: 6 }])).toBe("RECEIVED");
  });
});

describe("payment allocation", () => {
  const open = [
    { id: "b", dueDate: d("2026-11-01"), open: 5000 },
    { id: "a", dueDate: d("2026-10-01"), open: 3000 },
  ];
  it("pays the oldest due invoice first and keeps the rest as credit", () => {
    expect(allocatePayment(4000, open)).toEqual({ allocations: [{ invoiceId: "a", amount: 3000 }, { invoiceId: "b", amount: 1000 }], unallocated: 0 });
    expect(allocatePayment(10_000, open).unallocated).toBe(2000);
  });
  it("respects a manual selection", () => {
    expect(allocatePayment(4000, open, ["b"])).toEqual({ allocations: [{ invoiceId: "b", amount: 4000 }], unallocated: 0 });
    expect(() => allocatePayment(1, open, ["x"])).toThrow(OperationsError);
    expect(() => allocatePayment(0, open)).toThrow(OperationsError);
  });
});

describe("aging and dunning", () => {
  const today = d("2026-10-27");
  it("buckets by days overdue", () => {
    expect(agingBucket(d("2026-10-30"), today)).toBe("current");
    expect(agingBucket(d("2026-10-20"), today)).toBe("d1_30");
    expect(agingBucket(d("2026-09-10"), today)).toBe("d31_60");
    expect(agingBucket(d("2026-08-10"), today)).toBe("d61_90");
    expect(agingBucket(d("2026-01-01"), today)).toBe("d90_plus");
    expect(agingSummary([{ dueDate: d("2026-10-20"), open: 100 }, { dueDate: d("2026-01-01"), open: 50 }], today)).toMatchObject({ d1_30: 100, d90_plus: 50, total: 150 });
  });
  it("escalates reminders up to level 3 with spacing", () => {
    expect(nextDunningLevel(3, null, today)).toBeNull();
    expect(nextDunningLevel(10, null, today)).toBe(1);
    expect(nextDunningLevel(30, { level: 1, issuedAt: d("2026-10-20") }, today)).toBeNull();
    expect(nextDunningLevel(30, { level: 1, issuedAt: d("2026-10-01") }, today)).toBe(2);
    expect(nextDunningLevel(90, { level: 3, issuedAt: d("2026-08-01") }, today)).toBeNull();
  });
});

describe("cash and stocktake", () => {
  it("sums denominations and computes the difference", () => {
    expect(sumDenominations({ "20000": 2, "1000": 3, "50": 4 })).toBe(43_200);
    expect(cashDifference(43_000, 43_200)).toBe(200);
    expect(() => sumDenominations({ "x": 1 })).toThrow(OperationsError);
  });
  it("summarises stocktake variances", () => {
    expect(stocktakeVariance([{ expected: 10, counted: 12 }, { expected: 5, counted: 3 }, { expected: 1, counted: null }])).toEqual({ counted: 2, uncounted: 1, plus: 2, minus: 2 });
  });
});
