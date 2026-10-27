import { DOC_TYPES } from "@sa/core";
import { z } from "zod";
import { localeSchema, optionalText } from "./common";
import { orderStatusSchema } from "./shop";

export const docTypeSchema = z.enum(DOC_TYPES);
export const docLanguageSchema = z.enum(["AR", "EN", "BILINGUAL"]);

export const bankAccountSchema = z.object({
  bankNameAr: z.string().trim().min(2).max(120),
  bankNameEn: z.string().trim().min(2).max(120),
  branch: optionalText(120),
  accountName: z.string().trim().min(2).max(160),
  accountNo: z.string().trim().min(3).max(40),
  iban: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, "invalid_iban"))
    .nullish(),
  swift: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/, "invalid_swift").nullish(),
  showOnDocs: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});

export const documentTextSchema = z.object({
  docType: docTypeSchema,
  locale: localeSchema,
  titleText: optionalText(120),
  headerText: optionalText(2000),
  footerText: optionalText(500),
  termsText: optionalText(4000),
});

export const sequenceUpdateSchema = z.object({
  prefix: z.string().trim().regex(/^[A-Z]{1,5}$/, "invalid_prefix"),
  padding: z.number().int().min(4).max(10),
});

export const autoPrintRuleSchema = z.object({
  onStatus: orderStatusSchema,
  docType: z.enum(["ORDER_CONFIRMATION", "PICK_LIST", "DELIVERY_NOTE", "INVOICE"]),
  withPrices: z.boolean().default(true),
  language: docLanguageSchema.default("AR"),
  enabled: z.boolean().default(true),
});

export const taxInvoiceFieldsSchema = z.object({
  notesAr: optionalText(1000),
  notesEn: optionalText(1000),
});

export const creditNoteCreateSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  lines: z.array(z.object({ invoiceLineId: z.string().min(1).max(64), qtyBase: z.number().int().min(1) })).max(500).optional(),
});
