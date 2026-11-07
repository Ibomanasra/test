import { z } from "zod";
import { idSchema, nameSchema, nonNegativeAgorotSchema, optionalText, phoneSchema } from "./common";

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  promo: z.enum(["1"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export const unitCodeSchema = z.string().trim().regex(/^[A-Z_]{2,20}$/, "invalid_unit");

/** Der Client sendet NUR Variante, Einheit und Menge – niemals Preise */
export const cartItemAddSchema = z.object({
  variantId: idSchema,
  unitCode: unitCodeSchema,
  qty: z.number().int().min(1).max(100_000),
});

export const cartItemQtySchema = z.object({ qty: z.number().int().min(0).max(100_000) });
export const quickOrderSchema = z.object({ text: z.string().max(100_000) });
export const cartQuoteSchema = z.object({ quoteId: idSchema });
export const reorderSchema = z.object({ orderId: idSchema });
export const listCreateSchema = z.object({ name: nameSchema });

export const addressCreateSchema = z.object({
  /** leer = automatisch nach Ort, sonst Sammelzone „مناطق أخرى“ (OTHER) */
  zoneId: idSchema.optional().or(z.literal("").transform(() => undefined)),
  label: optionalText(60),
  recipient: nameSchema,
  phone: phoneSchema,
  city: z.string().trim().min(2).max(80),
  street: optionalText(160),
  details: optionalText(300),
  isDefault: z.boolean().default(false),
});

export const paymentMethodSchema = z.enum(["CASH_ON_DELIVERY", "BANK_TRANSFER", "CARD_GATEWAY", "ON_ACCOUNT"]);

const couponField = z.string().trim().max(40).optional().transform((v) => v || undefined);
export const checkoutPreviewSchema = z.object({ addressId: idSchema, couponCode: couponField });

export const placeOrderSchema = z.object({
  addressId: idSchema,
  paymentMethod: paymentMethodSchema,
  requestedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date"),
  customerNote: optionalText(1000),
  couponCode: couponField,
});

export const orderStatusSchema = z.enum(["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]);

export const orderListQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  channel: z.enum(["B2C", "B2B"]).optional(),
  q: z.string().trim().max(100).optional(),
  customerId: z.string().max(64).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const orderAdvanceSchema = z.object({ to: z.enum(["CONFIRMED", "PICKING", "READY"]), note: optionalText(500) });
export const orderCancelSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const orderDispatchSchema = z.object({
  quantities: z.record(z.string(), z.number().int().min(0)).optional(),
  remainder: z.enum(["BACKORDER", "CANCEL"]).default("BACKORDER"),
  /** Fahrer gleich beim Laden zuteilen (heutige Tour) */
  driverId: idSchema.optional().or(z.literal("").transform(() => undefined)),
});
export const orderDeliverSchema = z.object({ receivedByName: optionalText(120) });
export const orderFailSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const orderEditSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(64),
        unitCode: unitCodeSchema,
        qty: z.number().int().min(1),
        manualUnitPrice: nonNegativeAgorotSchema.nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
  confirmBelowMargin: z.boolean().default(false),
});

const slugSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,80}$/, "invalid_slug");

export const productSchema = z.object({
  slug: slugSchema,
  nameAr: nameSchema,
  nameEn: nameSchema,
  descriptionAr: optionalText(5000),
  descriptionEn: optionalText(5000),
  categoryId: idSchema,
  brand: optionalText(80),
  visibleB2C: z.boolean().default(true),
  visibleB2B: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const variantSchema = z.object({
  sku: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/, "invalid_sku"),
  barcode: z.string().trim().max(14).optional().nullable().transform((v) => v || null),
  nameAr: optionalText(120),
  nameEn: optionalText(120),
  costPrice: nonNegativeAgorotSchema.optional(),
  b2cPrice: nonNegativeAgorotSchema.optional(),
  b2bBasePrice: nonNegativeAgorotSchema.optional(),
  minStock: z.number().int().min(0).default(0),
  defaultBinCode: optionalText(30),
  active: z.boolean().default(true),
  units: z.array(z.object({ unitCode: unitCodeSchema, factor: z.number().int().min(1).max(100_000), barcode: z.string().trim().max(14).optional().nullable() })).min(1).max(6),
  rules: z
    .array(
      z.object({
        channel: z.enum(["B2C", "B2B"]),
        defaultUnitCode: unitCodeSchema,
        allowedUnitCodes: z.array(unitCodeSchema).min(1),
        minQtyBase: z.number().int().min(1),
        qtyStepBase: z.number().int().min(1),
      }),
    )
    .length(2),
});

export const productCreateSchema = z.object({ product: productSchema, variant: variantSchema });

export const categorySchema = z.object({
  slug: slugSchema,
  nameAr: nameSchema,
  nameEn: nameSchema,
  parentId: z.string().max(64).nullable().optional().transform((v) => v || null),
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

const optInt = (min: number, max: number) =>
  z.union([z.literal(""), z.coerce.number().int().min(min).max(max)]).optional().transform((v) => (v === "" || v === undefined ? undefined : v));

/** Schnell-Produkt (Formulardaten, Beträge in Agorot) */
export const quickProductSchema = z
  .object({
    nameAr: nameSchema,
    nameEn: z.string().trim().max(120).optional().transform((v) => v || undefined),
    categoryId: z.string().max(64).optional().transform((v) => v || undefined),
    newCategoryAr: z.string().trim().max(80).optional().transform((v) => v || undefined),
    b2cPrice: z.coerce.number().int().min(1).max(100_000_000),
    b2bPrice: optInt(1, 100_000_000),
    costPrice: optInt(0, 100_000_000),
    cartonSize: optInt(1, 100_000),
    stockQty: optInt(0, 10_000_000),
    barcode: z.string().trim().max(14).optional().transform((v) => v || undefined),
    descriptionAr: z.string().trim().max(5000).optional().transform((v) => v || undefined),
  })
  .refine((v) => Boolean(v.categoryId || v.newCategoryAr), { message: "category_required", path: ["categoryId"] });
