import "server-only";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_TTL_DAYS_CUSTOMER: z.coerce.number().int().min(1).default(60),
  SESSION_TTL_DAYS_STAFF: z.coerce.number().int().min(1).default(1),
  COOKIE_SECURE: bool,
  SMS_PROVIDER: z.enum(["log", "http", "twilio"]).default("log"),
  TWILIO_ACCOUNT_SID: z.string().default(""),
  TWILIO_AUTH_TOKEN: z.string().default(""),
  /** Twilio-Absender: Nummer (+1…), alphanumerisch (max. 11 Zeichen) oder Messaging-Service-SID (MG…) */
  TWILIO_FROM: z.string().default(""),
  SMS_SENDER_NAME: z.string().default("SholatAljanoub"),
  SMS_API_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  SMS_API_KEY: z.string().default(""),
  PUSH_PROVIDER: z.enum(["log", "expo"]).default("log"),
  /** optional: Expo-Access-Token (erhöhte Sicherheit beim Push-Versand) */
  EXPO_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_PROVIDER: z.enum(["log", "cloud"]).default("log"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_TOKEN: z.string().default(""),
  WHATSAPP_API_URL: z.string().url().default("https://graph.facebook.com/v21.0"),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  OTP_LIMIT_PER_PHONE: z.coerce.number().int().min(1).default(3),
  OTP_LIMIT_PHONE_WINDOW_SECONDS: z.coerce.number().int().min(60).default(600),
  OTP_LIMIT_PER_IP: z.coerce.number().int().min(1).default(20),
  OTP_LIMIT_IP_WINDOW_SECONDS: z.coerce.number().int().min(60).default(3600),
  OTP_DEV_FIXED_CODE: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{6}$/.test(v) ? v : undefined)),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("sa-files"),
  S3_ACCESS_KEY: z.string().default(""),
  S3_SECRET_KEY: z.string().default(""),
  S3_FORCE_PATH_STYLE: bool.default(true),
  UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(50).default(10),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_SECURE: bool,
  SMTP_FROM: z.string().default("Sholat Aljanoub <no-reply@sholat-aljanoub.local>"),
  // Zahlungs-Gateway (Phase 6): fake (Entwicklung), paytabs, arabbank (Mastercard Gateway)
  PAYMENT_GATEWAY: z.enum(["fake", "paytabs", "arabbank"]).default("fake"),
  PAYMENT_GATEWAY_URL: z.string().url().optional(),
  PAYMENT_GATEWAY_MERCHANT_ID: z.string().default(""),
  PAYMENT_GATEWAY_API_KEY: z.string().default(""),
  PAYMENT_GATEWAY_CALLBACK_SECRET: z.string().default(""),
  /** Minuten, nach denen unbezahlte Kartenbestellungen storniert werden */
  PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().min(5).default(60),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  // Leere Einträge aus .env (z. B. "PAYMENT_GATEWAY_URL=") gelten als nicht gesetzt → Standardwert
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.PAYMENT_GATEWAY !== "fake" && !parsed.data.PAYMENT_GATEWAY_API_KEY) {
    throw new Error("PAYMENT_GATEWAY_API_KEY is required for the configured payment gateway");
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.OTP_DEV_FIXED_CODE) {
    throw new Error("OTP_DEV_FIXED_CODE must not be set in production");
  }
  cached = parsed.data;
  return cached;
}
