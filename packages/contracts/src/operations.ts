import { z } from "zod";
import { idSchema, nonNegativeAgorotSchema, optionalText } from "./common";
import { daySchema, optionalDaySchema } from "./pricing";

const sku = z.string().trim().min(1).max(64);

// --- Lager -------------------------------------------------------------------

export const stockAdjustSchema = z.object({
  sku,
  /** Änderung in Basiseinheiten (+ Zugang / − Abgang) */
  qtyBase: z.number().int().refine((v) => v !== 0, "qty_zero"),
  reason: z.string().trim().min(3).max(300),
});

export const binSchema = z.object({
  code: z.string().trim().min(1).max(20),
  sortKey: z.number().int().min(0).max(1_000_000),
  active: z.boolean().default(true),
});

export const variantBinSchema = z.object({ sku, binId: idSchema.nullable() });

export const stocktakeCreateSchema = z.object({ note: optionalText(300), binPrefix: optionalText(20) });

export const stocktakeCountSchema = z.object({
  lines: z.array(z.object({ lineId: idSchema, countedQty: z.number().int().min(0).nullable() })).max(5000),
});

// --- Einkauf -----------------------------------------------------------------

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  contactName: optionalText(120),
  phone: optionalText(30),
  email: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
  dealerNumber: optionalText(30),
  address: optionalText(300),
  paymentTermDays: z.number().int().min(0).max(365).nullish(),
  active: z.boolean().default(true),
});

export const purchaseOrderSchema = z.object({
  supplierId: idSchema,
  expectedAt: optionalDaySchema,
  note: optionalText(500),
  items: z
    .array(
      z.object({
        sku,
        unitCode: z.string().trim().min(1).max(20),
        qty: z.number().int().min(1).max(1_000_000),
        /** Einkaufspreis netto je Verkaufseinheit */
        unitCost: nonNegativeAgorotSchema,
      }),
    )
    .min(1)
    .max(300),
});

export const goodsReceiptSchema = z.object({
  costUpdateMode: z.enum(["LAST", "WEIGHTED_AVG"]).default("WEIGHTED_AVG"),
  items: z
    .array(
      z.object({
        poItemId: idSchema,
        qtyBase: z.number().int().min(0),
        /** abweichender Einkaufspreis je Basiseinheit (sonst aus der Bestellung) */
        unitCostNet: nonNegativeAgorotSchema.nullish(),
        binId: idSchema.nullish(),
      }),
    )
    .min(1),
});

// --- Lieferung ---------------------------------------------------------------

export const tourCreateSchema = z.object({
  date: daySchema,
  driverId: idSchema,
  zoneId: idSchema.nullish(),
  note: optionalText(300),
  shipmentIds: z.array(idSchema).max(200).default([]),
});

export const tourStopsSchema = z.object({ shipmentIds: z.array(idSchema).max(200) });

export const deliverStopSchema = z.object({
  receivedByName: optionalText(120),
  /** kassierter Bargeldbetrag (Nachnahme) */
  cashAmount: nonNegativeAgorotSchema.default(0),
  /** Unterschrift als PNG-data:-URL (Canvas) */
  signature: z.string().max(400_000).regex(/^data:image\/png;base64,/).optional(),
});

export const failStopSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export const cashClosingSubmitSchema = z.object({
  denominations: z.record(z.string().regex(/^\d+$/), z.number().int().min(0).max(100_000)),
  note: optionalText(300),
});

// --- Finanzen ----------------------------------------------------------------

export const paymentCreateSchema = z.object({
  customerId: idSchema,
  method: z.enum(["CASH_ON_DELIVERY", "BANK_TRANSFER", "CARD_GATEWAY", "ON_ACCOUNT"]),
  amount: z.number().int().min(1),
  receivedAt: optionalDaySchema,
  reference: optionalText(120),
  note: optionalText(300),
  /** ausgewählte Rechnungen in Reihenfolge; leer = älteste zuerst */
  invoiceIds: z.array(idSchema).max(100).optional(),
});

export const paymentVoidSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export const returnCreateSchema = z.object({
  orderId: idSchema,
  reason: z.string().trim().min(3).max(300),
  restock: z.boolean().default(true),
  items: z.array(z.object({ orderItemId: idSchema, qtyBase: z.number().int().min(1) })).min(1).max(300),
});

export const dunningRunSchema = z.object({ customerIds: z.array(idSchema).max(500).optional(), feeAgorot: nonNegativeAgorotSchema.default(0) });

export const exportQuerySchema = z.object({
  kind: z.enum(["invoices", "credit-notes", "payments", "ledger"]),
  from: daySchema,
  to: daySchema,
  format: z.enum(["csv", "xlsx"]).default("xlsx"),
});

export const reportQuerySchema = z.object({
  kind: z.enum(["channel", "category", "product", "customer", "zone", "period", "top", "flop", "stock-value"]).default("channel"),
  from: optionalDaySchema,
  to: optionalDaySchema,
  channel: z.enum(["B2C", "B2B"]).optional(),
  format: z.enum(["html", "csv", "xlsx", "pdf"]).default("html"),
});
