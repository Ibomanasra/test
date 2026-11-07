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

/** Benutzername (z. B. „admin“) oder – für ältere Clients – Telefonnummer */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,31}$/, "invalid_username");

export const staffLoginSchema = z
  .object({
    login: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    password: z.string().min(1).max(200),
    client: z.enum(["WEB", "MOBILE"]).default("WEB"),
  })
  .refine((v) => Boolean(v.login || v.phone), { message: "login_required", path: ["login"] })
  .transform((v) => ({ login: (v.login ?? v.phone)!, password: v.password, client: v.client }));

export const staffVerifySchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

export const addressInputSchema = z.object({
  /** leer = automatisch nach Ort, sonst Sammelzone „مناطق أخرى“ (OTHER) */
  zoneId: idSchema.optional().or(z.literal("").transform(() => undefined)),
  label: optionalText(60),
  recipient: nameSchema,
  phone: phoneSchema,
  city: z.string().trim().min(2).max(80),
  street: optionalText(160),
  details: optionalText(300),
});
export type AddressInput = z.infer<typeof addressInputSchema>;

/** Kunden-Passwort (Login ohne SMS) */
export const customerPasswordSchema = z.string().min(8, "password_too_short").max(200);

/** Kunden-Login: Telefon + Passwort */
export const customerLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(200),
  client: z.enum(["WEB", "MOBILE"]).default("WEB"),
});

export const registerB2CSchema = z.object({
  /** nur im SMS-Modus (CUSTOMER_LOGIN_OTP=true): Nachweis der Nummer */
  registrationToken: z.string().min(10).optional(),
  /** ohne SMS-Modus: Telefon + Passwort direkt */
  phone: phoneSchema.optional(),
  password: customerPasswordSchema.optional(),
  name: nameSchema,
  locale: z.enum(["ar", "en", "he"]).default("ar"),
  address: addressInputSchema.omit({ phone: true, recipient: true }),
});
export type RegisterB2C = z.infer<typeof registerB2CSchema>;

/** Händlernummer (مشتغل مرخص): 9 Ziffern laut Steuerbehörde – Format konfigurierbar, hier 6–12 Ziffern */
export const dealerNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{6,12}$/, "invalid_dealer_number");

export const registerB2BSchema = z.object({
  registrationToken: z.string().min(10).optional(),
  phone: phoneSchema.optional(),
  password: customerPasswordSchema.optional(),
  name: nameSchema,
  locale: z.enum(["ar", "en", "he"]).default("ar"),
  companyName: nameSchema,
  ownerName: nameSchema,
  dealerNumber: dealerNumberSchema,
  email: z.string().trim().email().max(160).optional().or(z.literal("").transform(() => undefined)),
  address: addressInputSchema.omit({ phone: true, recipient: true }),
});
export type RegisterB2B = z.infer<typeof registerB2BSchema>;

export const LICENSE_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
