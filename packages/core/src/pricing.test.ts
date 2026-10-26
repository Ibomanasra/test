import { describe, expect, it } from "vitest";
import {
  PricingError,
  applyRounding,
  bulkAdjust,
  checkQuantity,
  isBelowMargin,
  isPromotionActive,
  isValidAt,
  marginBpsOf,
  minimumPriceNet,
  pickRoundingRule,
  resolvePrice,
  type PricingCustomer,
  type PricingProduct,
  type PromotionRule,
} from "./pricing";

const NOW = new Date("2026-10-26T10:00:00Z");
const PAST = new Date("2026-01-01T00:00:00Z");
const FUTURE = new Date("2027-01-01T00:00:00Z");

function product(overrides: Partial<PricingProduct> = {}, rules: PricingProduct["rules"] = {}): PricingProduct {
  return {
    variantId: "v1",
    categoryIds: ["cat-cleaning", "cat-root"],
    costPrice: 600, // 6,00 ₪
    b2cPrice: 1290, // 12,90 ₪ brutto
    b2bBasePrice: 1000, // 10,00 ₪ netto
    taxRateBps: 1600,
    rules,
    ...overrides,
  };
}

const STANDARD: PricingCustomer = { id: "c-std", groupId: "g-std", group: { id: "g-std", pricingMode: "DISCOUNT_PERCENT", discountBps: 0, priceListId: null } };
const GOLD: PricingCustomer = { id: "c-gold", groupId: "g-gold", group: { id: "g-gold", pricingMode: "DISCOUNT_PERCENT", discountBps: 600, priceListId: null } };
const LISTED: PricingCustomer = { id: "c-list", groupId: "g-key", group: { id: "g-key", pricingMode: "PRICE_LIST", discountBps: 0, priceListId: "pl-key" } };

const promo = (o: Partial<PromotionRule>): PromotionRule => ({
  id: "promo",
  channel: "BOTH",
  type: "PERCENT",
  startsAt: PAST,
  endsAt: FUTURE,
  active: true,
  priority: 0,
  percentBps: 1000,
  ...o,
});

describe("validity helpers", () => {
  it("checks validFrom (inclusive) and validTo (exclusive)", () => {
    expect(isValidAt({}, NOW)).toBe(true);
    expect(isValidAt({ validFrom: NOW }, NOW)).toBe(true);
    expect(isValidAt({ validTo: NOW }, NOW)).toBe(false);
    expect(isValidAt({ validFrom: FUTURE }, NOW)).toBe(false);
    expect(isValidAt({ validFrom: null, validTo: null }, NOW)).toBe(true);
  });

  it("checks promotion channel, period, active flag and group", () => {
    expect(isPromotionActive(promo({}), NOW, "B2C", null)).toBe(true);
    expect(isPromotionActive(promo({ channel: "B2B" }), NOW, "B2C", null)).toBe(false);
    expect(isPromotionActive(promo({ channel: "B2C" }), NOW, "B2B", "g")).toBe(false);
    expect(isPromotionActive(promo({ active: false }), NOW, "B2C", null)).toBe(false);
    expect(isPromotionActive(promo({ startsAt: FUTURE, endsAt: new Date("2028-01-01") }), NOW, "B2C", null)).toBe(false);
    expect(isPromotionActive(promo({ endsAt: NOW }), NOW, "B2C", null)).toBe(false);
    expect(isPromotionActive(promo({ groupId: "g-gold" }), NOW, "B2B", "g-gold")).toBe(true);
    expect(isPromotionActive(promo({ groupId: "g-gold" }), NOW, "B2B", "g-std")).toBe(false);
    expect(isPromotionActive(promo({ groupId: "g-gold" }), NOW, "B2C", null)).toBe(false);
  });
});

describe("applyRounding", () => {
  it.each([
    ["END_90", 1234, 1290],
    ["END_90", 1290, 1290],
    ["END_90", 1291, 1390],
    ["END_90", 1200, 1290],
    ["END_00", 1234, 1300],
    ["END_00", 1300, 1300],
    ["END_50_OR_00", 1234, 1250],
    ["END_50_OR_00", 1270, 1300],
    ["END_50_OR_00", 1250, 1250],
    ["NEAREST_10", 1234, 1230],
    ["NEAREST_10", 1235, 1240],
    ["NONE", 1234, 1234],
  ] as const)("%s %i → %i", (mode, input, expected) => {
    expect(applyRounding(input, mode)).toBe(expected);
  });

  it("leaves zero untouched", () => {
    expect(applyRounding(0, "END_90")).toBe(0);
  });

  it("picks the first active rule by sortOrder and threshold", () => {
    const rules = [
      { mode: "END_00" as const, minAgorot: 10_000, appliesToPromotions: true, appliesToBasePrices: true, active: true, sortOrder: 1 },
      { mode: "END_90" as const, minAgorot: 0, appliesToPromotions: true, appliesToBasePrices: false, active: true, sortOrder: 2 },
      { mode: "NEAREST_10" as const, minAgorot: 0, appliesToPromotions: true, appliesToBasePrices: true, active: false, sortOrder: 0 },
    ];
    expect(pickRoundingRule(rules, 15_000, "promotion")?.mode).toBe("END_00");
    expect(pickRoundingRule(rules, 500, "promotion")?.mode).toBe("END_90");
    expect(pickRoundingRule(rules, 500, "base")).toBeNull();
    expect(pickRoundingRule(undefined, 500, "base")).toBeNull();
  });
});

describe("margin", () => {
  it("computes minimum price and below-margin flag", () => {
    expect(minimumPriceNet(1000, 500)).toBe(1050);
    expect(isBelowMargin(1049, 1000, 500)).toBe(true);
    expect(isBelowMargin(1050, 1000, 500)).toBe(false);
  });

  it("computes margin on net price", () => {
    expect(marginBpsOf(1000, 600)).toBe(4000);
    expect(marginBpsOf(500, 600)).toBe(-2000);
    expect(marginBpsOf(0, 600)).toBe(-10_000);
    expect(marginBpsOf(0, 0)).toBe(0);
  });
});

describe("resolvePrice – B2C", () => {
  it("uses b2cPrice (gross) and splits net", () => {
    const r = resolvePrice(product(), null, 1, NOW, "B2C");
    expect(r).toMatchObject({ channel: "B2C", unitPrice: 1290, unitGross: 1290, unitNet: 1112, rule: "B2C_PRICE", freeQtyBase: 0, payableQtyBase: 1 });
    expect(r.trace.find((t) => t.applied)?.rule).toBe("B2C_PRICE");
  });

  it("applies an active B2C percent promotion and rounds it", () => {
    const rules = {
      promotions: [promo({ id: "p10", channel: "B2C", percentBps: 1000 })],
      roundingRules: [{ mode: "END_90" as const, minAgorot: 0, appliesToPromotions: true, appliesToBasePrices: false, active: true, sortOrder: 0 }],
    };
    // 12,90 − 10 % = 11,61 → 11,90
    const r = resolvePrice(product({}, rules), null, 1, NOW, "B2C");
    expect(r.rule).toBe("PROMOTION");
    expect(r.ruleRef).toBe("p10");
    expect(r.unitPrice).toBe(1190);
    expect(r.listUnitPrice).toBe(1290);
  });

  it("ignores B2B-only and expired promotions", () => {
    const rules = { promotions: [promo({ channel: "B2B" }), promo({ id: "old", channel: "B2C", endsAt: PAST, startsAt: new Date("2025-01-01") })] };
    expect(resolvePrice(product({}, rules), null, 1, NOW, "B2C").rule).toBe("B2C_PRICE");
  });

  it("never lets a promotion make the price more expensive", () => {
    const rules = { promotions: [promo({ type: "FIXED_PRICE", fixedPrice: 1500, channel: "B2C" })] };
    expect(resolvePrice(product({}, rules), null, 1, NOW, "B2C").unitPrice).toBe(1290);
  });

  it("supports fixed-price promotions", () => {
    const rules = { promotions: [promo({ type: "FIXED_PRICE", fixedPrice: 990, channel: "B2C" })] };
    expect(resolvePrice(product({}, rules), null, 3, NOW, "B2C")).toMatchObject({ unitPrice: 990, rule: "PROMOTION" });
  });

  it("supports buy-X-get-Y with free quantity", () => {
    const rules = { promotions: [promo({ type: "BUY_X_GET_Y", buyQty: 2, getQty: 1, channel: "B2C" })] };
    const r = resolvePrice(product({}, rules), null, 7, NOW, "B2C");
    // 7 Stück: 2 Gruppen à 3 → 2 gratis
    expect(r).toMatchObject({ rule: "PROMOTION", unitPrice: 1290, freeQtyBase: 2, payableQtyBase: 5 });
    // 2 Stück: keine Gratis-Einheit → normaler Preis gewinnt (gleichstand → Basis wäre teurer? nein: gleich)
    expect(resolvePrice(product({}, rules), null, 2, NOW, "B2C").freeQtyBase).toBe(0);
  });

  it("applies base rounding only when configured for base prices", () => {
    const rules = { roundingRules: [{ mode: "END_90" as const, minAgorot: 0, appliesToPromotions: false, appliesToBasePrices: true, active: true, sortOrder: 0 }] };
    expect(resolvePrice(product({ b2cPrice: 1234 }, rules), null, 1, NOW, "B2C").unitPrice).toBe(1290);
  });

  it("does not use any B2B rule for B2C customers", () => {
    const rules = { customerPrices: [{ id: "cp", priceNet: 100, isFixed: true }], tierPrices: [{ id: "t", groupId: null, minQtyBase: 1, priceNet: 100 }] };
    expect(resolvePrice(product({}, rules), GOLD, 100, NOW, "B2C").unitPrice).toBe(1290);
  });
});

describe("resolvePrice – B2B chain", () => {
  it("uses b2bBasePrice (net) for standard group without discount", () => {
    const r = resolvePrice(product(), STANDARD, 12, NOW, "B2B");
    expect(r).toMatchObject({ unitPrice: 1000, unitNet: 1000, unitGross: 1160, rule: "BASE_PRICE", marginBps: 4000 });
  });

  it("works without a customer (base price)", () => {
    expect(resolvePrice(product(), null, 1, NOW, "B2B").unitPrice).toBe(1000);
  });

  it("applies the group discount", () => {
    expect(resolvePrice(product(), GOLD, 1, NOW, "B2B")).toMatchObject({ unitPrice: 940, rule: "GROUP_DISCOUNT", ruleRef: "g-gold" });
  });

  it("uses the group price list instead of base − discount", () => {
    const rules = { priceListItems: [{ id: "pli", priceListId: "pl-key", priceNet: 880 }, { id: "other", priceListId: "pl-x", priceNet: 1 }] };
    expect(resolvePrice(product({}, rules), LISTED, 1, NOW, "B2B")).toMatchObject({ unitPrice: 880, rule: "GROUP_PRICE_LIST" });
  });

  it("falls back to base price when the price list has no (valid) item", () => {
    const rules = { priceListItems: [{ id: "pli", priceListId: "pl-key", priceNet: 880, validFrom: FUTURE }] };
    expect(resolvePrice(product({}, rules), LISTED, 1, NOW, "B2B")).toMatchObject({ unitPrice: 1000, rule: "BASE_PRICE" });
  });

  it("applies tier prices only from the threshold and only if cheaper", () => {
    const rules = {
      tierPrices: [
        { id: "t48", groupId: null, minQtyBase: 48, priceNet: 850 },
        { id: "t120", groupId: null, minQtyBase: 120, priceNet: 790 },
        { id: "tgold", groupId: "g-gold", minQtyBase: 48, priceNet: 960 },
      ],
    };
    expect(resolvePrice(product({}, rules), STANDARD, 47, NOW, "B2B").rule).toBe("BASE_PRICE");
    expect(resolvePrice(product({}, rules), STANDARD, 48, NOW, "B2B")).toMatchObject({ unitPrice: 850, rule: "TIER_PRICE", ruleRef: "t48" });
    expect(resolvePrice(product({}, rules), STANDARD, 120, NOW, "B2B")).toMatchObject({ unitPrice: 790, ruleRef: "t120" });
    // Gold hat 9,40 durch Gruppenrabatt; Gold-Staffel 9,60 ist teurer, allgemeine Staffel 8,50 günstiger
    expect(resolvePrice(product({}, rules), GOLD, 48, NOW, "B2B")).toMatchObject({ unitPrice: 850, ruleRef: "t48" });
  });

  it("ignores tier prices of other groups", () => {
    const rules = { tierPrices: [{ id: "tgold", groupId: "g-gold", minQtyBase: 1, priceNet: 500 }] };
    expect(resolvePrice(product({}, rules), STANDARD, 10, NOW, "B2B").unitPrice).toBe(1000);
    expect(resolvePrice(product({}, rules), GOLD, 10, NOW, "B2B").unitPrice).toBe(500);
  });

  it("applies the category discount on top of the chain (group or customer, highest wins)", () => {
    const rules = {
      categoryDiscounts: [
        { id: "cd-gold", categoryId: "cat-cleaning", groupId: "g-gold", customerId: null, discountBps: 500 },
        { id: "cd-cust", categoryId: "cat-root", groupId: null, customerId: "c-gold", discountBps: 800 },
        { id: "cd-other", categoryId: "cat-other", groupId: "g-gold", customerId: null, discountBps: 5000 },
      ],
    };
    // 10,00 − 6 % = 9,40 → −8 % = 8,648 → 8,65
    expect(resolvePrice(product({}, rules), GOLD, 1, NOW, "B2B")).toMatchObject({ unitPrice: 865, rule: "CATEGORY_DISCOUNT", ruleRef: "cd-cust" });
    expect(resolvePrice(product({}, rules), STANDARD, 1, NOW, "B2B").unitPrice).toBe(1000);
  });

  it("applies the category discount after a tier price", () => {
    const rules = {
      tierPrices: [{ id: "t", groupId: null, minQtyBase: 10, priceNet: 800 }],
      categoryDiscounts: [{ id: "cd", categoryId: "cat-cleaning", groupId: "g-std", customerId: null, discountBps: 1000 }],
    };
    expect(resolvePrice(product({}, rules), STANDARD, 10, NOW, "B2B").unitPrice).toBe(720);
  });
});

describe("resolvePrice – B2B competing rules", () => {
  it("non-fixed special price competes – cheapest wins", () => {
    const cheap = { customerPrices: [{ id: "cp", priceNet: 900, isFixed: false }] };
    expect(resolvePrice(product({}, cheap), STANDARD, 1, NOW, "B2B")).toMatchObject({ unitPrice: 900, rule: "CUSTOMER_PRICE" });
    const expensive = { customerPrices: [{ id: "cp", priceNet: 990, isFixed: false }] };
    expect(resolvePrice(product({}, expensive), GOLD, 1, NOW, "B2B")).toMatchObject({ unitPrice: 940, rule: "GROUP_DISCOUNT" });
  });

  it("fixed special price wins even if more expensive", () => {
    const rules = { customerPrices: [{ id: "cp", priceNet: 990, isFixed: true }], tierPrices: [{ id: "t", groupId: null, minQtyBase: 1, priceNet: 500 }] };
    expect(resolvePrice(product({}, rules), GOLD, 10, NOW, "B2B")).toMatchObject({ unitPrice: 990, rule: "CUSTOMER_PRICE" });
  });

  it("only uses special prices valid at the date (newest first)", () => {
    const rules = {
      customerPrices: [
        { id: "old", priceNet: 700, isFixed: true, validFrom: new Date("2025-01-01"), validTo: PAST },
        { id: "a", priceNet: 950, isFixed: true, validFrom: new Date("2026-02-01") },
        { id: "b", priceNet: 930, isFixed: true, validFrom: new Date("2026-06-01") },
        { id: "future", priceNet: 100, isFixed: true, validFrom: FUTURE },
      ],
    };
    expect(resolvePrice(product({}, rules), STANDARD, 1, NOW, "B2B")).toMatchObject({ unitPrice: 930, ruleRef: "b" });
  });

  it("fixed accepted quote beats everything, including a fixed special price", () => {
    const rules = {
      quote: { quoteId: "q1", unitPriceNet: 960, isFixed: true },
      customerPrices: [{ id: "cp", priceNet: 500, isFixed: true }],
    };
    expect(resolvePrice(product({}, rules), STANDARD, 1, NOW, "B2B")).toMatchObject({ unitPrice: 960, rule: "QUOTE", ruleRef: "q1" });
  });

  it("non-fixed quote competes with the chain", () => {
    const rules = { quote: { quoteId: "q1", unitPriceNet: 960, isFixed: false } };
    expect(resolvePrice(product({}, rules), GOLD, 1, NOW, "B2B").rule).toBe("GROUP_DISCOUNT");
    expect(resolvePrice(product({}, rules), STANDARD, 1, NOW, "B2B").rule).toBe("QUOTE");
  });

  it("B2B promotion competes; category discount is NOT added on top of it", () => {
    const rules = {
      promotions: [promo({ id: "b2b10", channel: "B2B", percentBps: 1000 })],
      categoryDiscounts: [{ id: "cd", categoryId: "cat-cleaning", groupId: "g-std", customerId: null, discountBps: 500 }],
    };
    // Aktion: 10,00 − 10 % = 9,00 ; Kette: 10,00 − 5 % = 9,50 → Aktion gewinnt, kein weiterer Rabatt
    expect(resolvePrice(product({}, rules), STANDARD, 1, NOW, "B2B")).toMatchObject({ unitPrice: 900, rule: "PROMOTION", ruleRef: "b2b10" });
  });

  it("B2C promotions do not apply to B2B", () => {
    const rules = { promotions: [promo({ channel: "B2C", percentBps: 5000 })] };
    expect(resolvePrice(product({}, rules), STANDARD, 1, NOW, "B2B").unitPrice).toBe(1000);
  });

  it("group-specific promotion applies only to that group", () => {
    const rules = { promotions: [promo({ channel: "B2B", groupId: "g-gold", type: "FIXED_PRICE", fixedPrice: 700 })] };
    expect(resolvePrice(product({}, rules), GOLD, 1, NOW, "B2B").unitPrice).toBe(700);
    expect(resolvePrice(product({}, rules), STANDARD, 1, NOW, "B2B").unitPrice).toBe(1000);
  });

  it("buy-X-get-Y compares by total, using the chain price per unit", () => {
    const rules = { promotions: [promo({ channel: "B2B", type: "BUY_X_GET_Y", buyQty: 10, getQty: 2 })] };
    const r = resolvePrice(product({}, rules), GOLD, 24, NOW, "B2B");
    expect(r).toMatchObject({ rule: "PROMOTION", unitPrice: 940, freeQtyBase: 4, payableQtyBase: 20 });
  });

  it("higher-priority promotion wins on equal totals", () => {
    const rules = {
      promotions: [
        promo({ id: "low", channel: "B2B", type: "FIXED_PRICE", fixedPrice: 800, priority: 0 }),
        promo({ id: "high", channel: "B2B", type: "FIXED_PRICE", fixedPrice: 800, priority: 5 }),
      ],
    };
    expect(resolvePrice(product({}, rules), STANDARD, 1, NOW, "B2B").ruleRef).toBe("high");
  });

  it("explains the decision in the trace with exactly one applied entry", () => {
    const rules = {
      tierPrices: [{ id: "t", groupId: null, minQtyBase: 10, priceNet: 850 }],
      customerPrices: [{ id: "cp", priceNet: 900, isFixed: false }],
    };
    const r = resolvePrice(product({}, rules), GOLD, 10, NOW, "B2B");
    expect(r.rule).toBe("TIER_PRICE");
    expect(r.trace.map((t) => t.rule)).toEqual(expect.arrayContaining(["CUSTOMER_PRICE", "BASE_PRICE", "GROUP_DISCOUNT", "TIER_PRICE"]));
    expect(r.trace.filter((t) => t.applied)).toHaveLength(1);
    expect(r.trace.find((t) => t.applied)?.ref).toBe("t");
  });

  it("reports negative margin when selling below cost", () => {
    const rules = { customerPrices: [{ id: "cp", priceNet: 500, isFixed: true }] };
    const r = resolvePrice(product({}, rules), STANDARD, 1, NOW, "B2B");
    expect(r.marginBps).toBe(-2000);
  });
});

describe("resolvePrice – validation", () => {
  it("rejects invalid quantities and prices", () => {
    expect(() => resolvePrice(product(), null, 0, NOW, "B2C")).toThrow(PricingError);
    expect(() => resolvePrice(product(), null, 1.5, NOW, "B2C")).toThrow(PricingError);
    expect(() => resolvePrice(product({ b2cPrice: -1 }), null, 1, NOW, "B2C")).toThrow(PricingError);
    expect(() => resolvePrice(product({ b2bBasePrice: 10.5 }), null, 1, NOW, "B2B")).toThrow();
  });
});

describe("checkQuantity", () => {
  const carton = { minQtyBase: 24, qtyStepBase: 12 };
  it("validates minimum and step", () => {
    expect(checkQuantity(24, carton)).toBeNull();
    expect(checkQuantity(36, carton)).toBeNull();
    expect(checkQuantity(12, carton)).toBe("below_minimum");
    expect(checkQuantity(30, carton)).toBe("invalid_step");
    expect(checkQuantity(0, carton)).toBe("invalid_quantity");
    expect(checkQuantity(2.5, carton)).toBe("invalid_quantity");
  });
});

describe("bulkAdjust", () => {
  it("raises/lowers prices by percent with optional rounding", () => {
    expect(bulkAdjust(1000, 500)).toBe(1050);
    expect(bulkAdjust(1290, 500)).toBe(1355);
    expect(bulkAdjust(1290, 500, "END_90")).toBe(1390);
    expect(bulkAdjust(1000, -1000)).toBe(900);
  });
});
