import { startOfBusinessDay } from "@sa/core";
import { z } from "zod";
import { bpsSchema, idSchema, nameSchema, nonNegativeAgorotSchema } from "./common";

/** "YYYY-MM-DD" → 00:00 Ortszeit; leer → null */
export const optionalDaySchema = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date"), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? startOfBusinessDay(v) : null));

export const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
  .transform((v) => startOfBusinessDay(v));

/** Datum + Uhrzeit (datetime-local "YYYY-MM-DDTHH:mm", Ortszeit Hebron) */
export const dateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "invalid_date")
  .transform((v) => {
    const [day, time] = v.split("T") as [string, string];
    const [h, m] = time.split(":").map(Number) as [number, number];
    return new Date(startOfBusinessDay(day).getTime() + (h * 60 + m) * 60_000);
  });

export const skuSchema = z.string().trim().min(1).max(64);

export const variantPriceUpdateSchema = z.object({
  costPrice: nonNegativeAgorotSchema.optional(),
  b2cPrice: nonNegativeAgorotSchema.optional(),
  b2bBasePrice: nonNegativeAgorotSchema.optional(),
  /** Bewusste Bestätigung eines Preises unter Mindestmarge (Recht price.confirm_below_margin) */
  confirmBelowMargin: z.boolean().default(false),
});
export type VariantPriceUpdate = z.infer<typeof variantPriceUpdateSchema>;

export const priceListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: z.string().max(64).optional(),
  belowMargin: z.enum(["1"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const groupSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Z0-9_]{2,30}$/, "invalid_code"),
    nameAr: nameSchema,
    nameEn: nameSchema,
    pricingMode: z.enum(["DISCOUNT_PERCENT", "PRICE_LIST"]),
    discountBps: bpsSchema.default(0),
    priceListId: z.string().max(64).nullable().optional().transform((v) => v || null),
    defaultPaymentTermDays: z.number().int().min(0).max(365).nullable().optional(),
    defaultCreditLimitAgorot: nonNegativeAgorotSchema.nullable().optional(),
    sortOrder: z.number().int().min(0).default(0),
    active: z.boolean().default(true),
  })
  .refine((g) => g.pricingMode !== "PRICE_LIST" || !!g.priceListId, { message: "price_list_required", path: ["priceListId"] });

export const priceListSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_]{2,30}$/, "invalid_code"),
  nameAr: nameSchema,
  nameEn: nameSchema,
  active: z.boolean().default(true),
});

export const priceListItemSchema = z.object({
  priceListId: idSchema,
  sku: skuSchema,
  priceNet: nonNegativeAgorotSchema,
  validFrom: optionalDaySchema,
  validTo: optionalDaySchema,
  confirmBelowMargin: z.boolean().default(false),
});

export const tierPriceSchema = z.object({
  sku: skuSchema,
  groupId: z.string().max(64).nullable().optional().transform((v) => v || null),
  minQtyBase: z.number().int().min(1),
  priceNet: nonNegativeAgorotSchema,
  validFrom: optionalDaySchema,
  validTo: optionalDaySchema,
  confirmBelowMargin: z.boolean().default(false),
});

export const customerPriceSchema = z.object({
  customerId: idSchema,
  sku: skuSchema,
  priceNet: nonNegativeAgorotSchema,
  isFixed: z.boolean().default(false),
  validFrom: optionalDaySchema,
  validTo: optionalDaySchema,
  note: z.string().trim().max(300).optional(),
  confirmBelowMargin: z.boolean().default(false),
});

export const categoryDiscountSchema = z
  .object({
    categoryId: idSchema,
    groupId: z.string().max(64).nullable().optional().transform((v) => v || null),
    customerId: z.string().max(64).nullable().optional().transform((v) => v || null),
    discountBps: bpsSchema,
    validFrom: optionalDaySchema,
    validTo: optionalDaySchema,
  })
  .refine((d) => (d.groupId ? 1 : 0) + (d.customerId ? 1 : 0) === 1, { message: "group_or_customer", path: ["groupId"] });

export const promotionSchema = z
  .object({
    nameAr: nameSchema,
    nameEn: nameSchema,
    channel: z.enum(["B2C", "B2B", "BOTH"]),
    type: z.enum(["PERCENT", "FIXED_PRICE", "BUY_X_GET_Y"]),
    startsAt: dateTimeSchema,
    endsAt: dateTimeSchema,
    active: z.boolean().default(true),
    priority: z.number().int().min(0).max(100).default(0),
    percentBps: bpsSchema.nullable().optional(),
    buyQty: z.number().int().min(1).nullable().optional(),
    getQty: z.number().int().min(1).nullable().optional(),
    groupId: z.string().max(64).nullable().optional().transform((v) => v || null),
    /** Ziel: SKU ODER Kategorie */
    targetSku: z.string().trim().max(64).optional().transform((v) => v || undefined),
    targetCategoryId: z.string().max(64).optional().transform((v) => v || undefined),
    fixedPrice: nonNegativeAgorotSchema.nullable().optional(),
  })
  .refine((p) => p.endsAt > p.startsAt, { message: "invalid_period", path: ["endsAt"] })
  .refine((p) => (p.targetSku ? 1 : 0) + (p.targetCategoryId ? 1 : 0) === 1, { message: "target_required", path: ["targetSku"] })
  .refine((p) => p.type !== "PERCENT" || (p.percentBps ?? 0) > 0, { message: "percent_required", path: ["percentBps"] })
  .refine((p) => p.type !== "FIXED_PRICE" || (p.fixedPrice != null && !!p.targetSku), { message: "fixed_price_needs_sku", path: ["fixedPrice"] })
  .refine((p) => p.type !== "BUY_X_GET_Y" || (!!p.buyQty && !!p.getQty), { message: "buy_get_required", path: ["buyQty"] })
  .refine((p) => !p.groupId || p.channel !== "B2C", { message: "group_only_b2b", path: ["groupId"] });

export const roundingRuleSchema = z.object({
  mode: z.enum(["NONE", "END_90", "END_00", "END_50_OR_00", "NEAREST_10"]),
  minAgorot: nonNegativeAgorotSchema.default(0),
  appliesToPromotions: z.boolean().default(true),
  appliesToBasePrices: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const priceFieldSchema = z.enum(["COST", "B2C", "B2B_BASE"]);

export const scheduledPriceSchema = z.object({
  sku: skuSchema,
  field: priceFieldSchema,
  newPrice: nonNegativeAgorotSchema,
  effectiveAt: daySchema,
});

export const bulkAdjustSchema = z.object({
  categoryId: z.string().max(64).optional().transform((v) => v || undefined),
  field: priceFieldSchema,
  changeBps: z.number().int().min(-9000).max(100_000).refine((v) => v !== 0, { message: "change_required" }),
  rounding: z.enum(["NONE", "END_90", "END_00", "END_50_OR_00", "NEAREST_10"]).default("NONE"),
  /** leer = sofort, sonst geplant ab diesem Tag */
  effectiveAt: optionalDaySchema,
  apply: z.boolean().default(false),
  confirmBelowMargin: z.boolean().default(false),
});

export const pricePreviewSchema = z.object({
  sku: skuSchema,
  customerId: z.string().max(64).optional().transform((v) => v || undefined),
  channel: z.enum(["B2C", "B2B"]).optional(),
  qtyBase: z.coerce.number().int().min(1).max(1_000_000),
  date: optionalDaySchema,
});

export const quoteItemInputSchema = z.object({
  sku: skuSchema,
  unitCode: z.string().trim().max(20).default("PIECE"),
  qty: z.number().int().min(1),
  unitPriceNet: nonNegativeAgorotSchema,
});

export const quoteCreateSchema = z.object({
  customerId: idSchema,
  validUntil: daySchema,
  isFixed: z.boolean().default(true),
  internalNote: z.string().trim().max(1000).optional(),
  items: z.array(quoteItemInputSchema).min(1).max(500),
});

export const quoteRequestSchema = z.object({
  note: z.string().trim().min(3).max(2000),
  items: z.array(z.object({ sku: skuSchema, qty: z.number().int().min(1) })).max(200).default([]),
});
