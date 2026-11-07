import { startOfBusinessDay } from "@sa/core";
import { z } from "zod";
import {
  bpsSchema,
  idSchema,
  nameSchema,
  nonNegativeAgorotSchema,
  optionalText,
  permissionSchema,
  phoneSchema,
} from "./common";
import { dealerNumberSchema, usernameSchema } from "./auth";

export const customerStatusSchema = z.enum(["ACTIVE", "PENDING_APPROVAL", "REJECTED", "BLOCKED"]);
export const customerTypeSchema = z.enum(["B2C", "B2B"]);

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: customerTypeSchema.optional(),
  status: customerStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const approveCustomerSchema = z.object({
  groupId: idSchema,
  paymentTermDays: z.number().int().min(0).max(365),
  creditLimitAgorot: nonNegativeAgorotSchema,
  allowOnAccount: z.boolean(),
});
export type ApproveCustomer = z.infer<typeof approveCustomerSchema>;

export const rejectCustomerSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const blockCustomerSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export const updateCustomerCreditSchema = approveCustomerSchema;

/** Stammdaten durch die Verwaltung; Telefon ändert auch die Anmeldenummer des Inhabers */
export const customerUpdateSchema = z.object({
  displayName: nameSchema,
  companyName: nameSchema.optional().or(z.literal("").transform(() => undefined)),
  ownerName: nameSchema.optional().or(z.literal("").transform(() => undefined)),
  dealerNumber: dealerNumberSchema.optional().or(z.literal("").transform(() => undefined)),
  phone: phoneSchema,
  email: z.string().trim().email().max(160).optional().or(z.literal("").transform(() => undefined)),
  preferredLocale: z.enum(["ar", "en", "he"]),
});
export type CustomerUpdate = z.infer<typeof customerUpdateSchema>;

export const customerNoteSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export const roleKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_-]{1,40}$/, "invalid_role_key");

export const roleUpsertSchema = z.object({
  key: roleKeySchema,
  nameAr: nameSchema,
  nameEn: nameSchema,
  permissions: z.array(permissionSchema).max(200),
});

export const passwordSchema = z
  .string()
  .min(10, "password_too_short")
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), { message: "password_too_weak" });

export const staffCreateSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  password: passwordSchema,
  roleIds: z.array(idSchema).min(1),
  locale: z.enum(["ar", "en", "he"]).default("ar"),
});

export const staffUpdateSchema = z.object({
  name: nameSchema.optional(),
  username: usernameSchema.optional(),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  password: passwordSchema.optional().or(z.literal("").transform(() => undefined)),
  roleIds: z.array(idSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const companySettingsSchema = z.object({
  nameAr: nameSchema,
  nameEn: nameSchema,
  addressAr: z.string().trim().min(3).max(300),
  addressEn: z.string().trim().min(3).max(300),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  website: optionalText(200),
  dealerNumber: z.string().trim().min(3).max(30),
  taxFileNumber: optionalText(30),
  minMarginBps: bpsSchema,
  defaultPaymentTermDays: z.number().int().min(0).max(365),
  quoteValidityDays: z.number().int().min(1).max(365),
});

export const taxRateCreateSchema = z.object({
  code: z.string().trim().regex(/^[A-Z_]{2,20}$/).default("STANDARD"),
  rateBps: bpsSchema,
  /** Kalendertag "YYYY-MM-DD"; gilt ab 00:00 Ortszeit (Asia/Hebron) */
  validFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
    .transform((v) => startOfBusinessDay(v)),
});

export const deliveryZoneSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_]{2,30}$/, "invalid_code"),
  nameAr: nameSchema,
  nameEn: nameSchema,
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  deliveryWeekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  rates: z
    .array(
      z.object({
        channel: z.enum(["B2C", "B2B"]),
        feeGrossAgorot: nonNegativeAgorotSchema,
        minOrderAgorot: nonNegativeAgorotSchema,
        freeFromAgorot: nonNegativeAgorotSchema.nullable(),
      }),
    )
    .length(2)
    .refine((r) => new Set(r.map((x) => x.channel)).size === 2, { message: "one_rate_per_channel" }),
});
export type DeliveryZoneInput = z.infer<typeof deliveryZoneSchema>;

export const paymentMethodUpdateSchema = z.object({
  enabled: z.boolean(),
  labelAr: nameSchema,
  labelEn: nameSchema,
  sortOrder: z.number().int().min(0).max(999),
});

export const auditQuerySchema = z.object({
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(64).optional(),
  actorId: z.string().max(64).optional(),
  action: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

/** MwSt.-Schalter: Satz gilt ab sofort */
export const vatSwitchSchema = z.object({ rateBps: z.number().int().min(0).max(5000) });

/** Startseite: Überschrift und Text (leer = Standard) */
export const storefrontTextSchema = z.object({
  heroTitleAr: z.string().trim().max(120).optional().transform((v) => v || null),
  heroTitleEn: z.string().trim().max(120).optional().transform((v) => v || null),
  heroTextAr: z.string().trim().max(300).optional().transform((v) => v || null),
  heroTextEn: z.string().trim().max(300).optional().transform((v) => v || null),
});
