import { isValidPhone, normalizePhone, normalizeDigits, isPermission } from "@sa/core";
import { z } from "zod";

/** Telefonnummer → E.164 (+970… / +972…) */
export const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(20)
  .refine(isValidPhone, { message: "invalid_phone" })
  .transform((v) => normalizePhone(v));

export const otpCodeSchema = z
  .string()
  .transform((v) => normalizeDigits(v).replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "invalid_code"));

export const localeSchema = z.enum(["ar", "en"]);
export const channelSchema = z.enum(["B2C", "B2B"]);
export const idSchema = z.string().min(1).max(64);

/** Ganzzahliger Agorot-Betrag (Client sendet nie Preise für Bestellungen – nur Admin-Stammdaten) */
export const agorotSchema = z.number().int().safe();
export const nonNegativeAgorotSchema = agorotSchema.min(0);
export const bpsSchema = z.number().int().min(0).max(10_000);

export const nameSchema = z.string().trim().min(2).max(120);
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const permissionSchema = z.string().refine((p) => p === "*" || isPermission(p), {
  message: "unknown_permission",
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
