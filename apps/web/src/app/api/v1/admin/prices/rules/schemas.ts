import {
  categoryDiscountSchema,
  customerPriceSchema,
  groupSchema,
  priceListItemSchema,
  priceListSchema,
  promotionSchema,
  roundingRuleSchema,
  scheduledPriceSchema,
  tierPriceSchema,
} from "@sa/contracts";
import type { ZodType } from "zod";

export const RULE_SCHEMAS: Record<string, ZodType> = {
  groups: groupSchema,
  "price-lists": priceListSchema,
  "price-list-items": priceListItemSchema,
  tiers: tierPriceSchema,
  "customer-prices": customerPriceSchema,
  "category-discounts": categoryDiscountSchema,
  promotions: promotionSchema,
  rounding: roundingRuleSchema,
  scheduled: scheduledPriceSchema,
};
