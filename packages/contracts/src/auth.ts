import { z } from "zod";
import { idSchema, nameSchema, optionalText, otpCodeSchema, phoneSchema } from "./common";

export const otpPurposeSchema = z.enum(["LOGIN", "REGISTER"]);

export const otpRequestSchema = z.object({
  phone: phoneSchema,
  purpose: otpPurposeSchema.default("LOGIN"),
});
export type OtpRequest = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  client: z.enum(["WEB", "MOBILE"]).default("WEB"),
});
export type OtpVerify = z.infer<typeof otpVerifySchema>;

export const staffLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(200),
});

export const staffVerifySchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

export const addressInputSchema = z.object({
  zoneId: idSchema,
  label: optionalText(60),
  recipient: nameSchema,
  phone: phoneSchema,
  city: z.string().trim().min(2).max(80),
  street: optionalText(160),
  details: optionalText(300),
});
export type AddressInput = z.infer<typeof addressInputSchema>;

export const registerB2CSchema = z.object({
  registrationToken: z.string().min(10),
  name: nameSchema,
  locale: z.enum(["ar", "en"]).default("ar"),
  address: addressInputSchema.omit({ phone: true, recipient: true }),
});
export type RegisterB2C = z.infer<typeof registerB2CSchema>;

/** Händlernummer (مشتغل مرخص): 9 Ziffern laut Steuerbehörde – Format konfigurierbar, hier 6–12 Ziffern */
export const dealerNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{6,12}$/, "invalid_dealer_number");

export const registerB2BSchema = z.object({
  registrationToken: z.string().min(10),
  name: nameSchema,
  locale: z.enum(["ar", "en"]).default("ar"),
  companyName: nameSchema,
  ownerName: nameSchema,
  dealerNumber: dealerNumberSchema,
  email: z.string().trim().email().max(160).optional().or(z.literal("").transform(() => undefined)),
  address: addressInputSchema.omit({ phone: true, recipient: true }),
});
export type RegisterB2B = z.infer<typeof registerB2BSchema>;

export const LICENSE_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
