import "server-only";
import { prisma, type Locale, type OtpPurpose } from "@sa/db";
import { smsAdapter } from "../adapters/sms";
import { hmac, randomOtpCode, safeEqual } from "../crypto";
import { env } from "../env";
import { AppError, badRequest } from "../errors";
import { hitRateLimit } from "./rate-limit";

const OTP_TEXT: Record<Locale, (code: string, minutes: number) => string> = {
  ar: (code, m) => `رمز التحقق الخاص بك في شعلة الجنوب: ${code} (صالح لمدة ${m} دقائق). لا تشاركه مع أحد.`,
  en: (code, m) => `Your Sholat Aljanoub verification code: ${code} (valid for ${m} minutes). Do not share it.`,
};

function codeHash(phone: string, purpose: OtpPurpose, code: string): string {
  return hmac(`otp:${purpose}:${phone}:${code}`);
}

export interface RequestOtpInput {
  phone: string;
  purpose: OtpPurpose;
  ip: string;
  locale: Locale;
}

/** Erzeugt einen Code, macht ältere ungültig und verschickt ihn per SMS-Adapter. */
export async function requestOtp({ phone, purpose, ip, locale }: RequestOtpInput): Promise<{ expiresInSeconds: number }> {
  const e = env();
  await hitRateLimit(`otp:phone:${phone}`, e.OTP_LIMIT_PER_PHONE, e.OTP_LIMIT_PHONE_WINDOW_SECONDS);
  await hitRateLimit(`otp:ip:${ip}`, e.OTP_LIMIT_PER_IP, e.OTP_LIMIT_IP_WINDOW_SECONDS);

  const code = e.OTP_DEV_FIXED_CODE ?? randomOtpCode();
  const now = new Date();
  await prisma.$transaction([
    prisma.otpChallenge.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: now },
    }),
    prisma.otpChallenge.create({
      data: {
        phone,
        purpose,
        codeHash: codeHash(phone, purpose, code),
        maxAttempts: e.OTP_MAX_ATTEMPTS,
        ip,
        expiresAt: new Date(now.getTime() + e.OTP_TTL_SECONDS * 1000),
      },
    }),
  ]);
  await smsAdapter().send({
    to: phone,
    template: "otp",
    locale,
    text: OTP_TEXT[locale](code, Math.round(e.OTP_TTL_SECONDS / 60)),
    payload: { purpose },
  });
  return { expiresInSeconds: e.OTP_TTL_SECONDS };
}

/**
 * Prüft einen Code. Jeder Versuch zählt (atomar), nach maxAttempts ist der
 * Code verbraucht. Erfolgreiche Codes sind nur einmal verwendbar.
 */
export async function verifyOtp(phone: string, purpose: OtpPurpose, code: string, ip: string): Promise<void> {
  await hitRateLimit(`otp-verify:ip:${ip}`, 60, 3600);
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) throw badRequest("otp_invalid");

  const counted = await prisma.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null, attempts: { lt: challenge.maxAttempts } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    throw new AppError(429, "otp_too_many_attempts");
  }

  if (!safeEqual(challenge.codeHash, codeHash(phone, purpose, code))) {
    if (challenge.attempts + 1 >= challenge.maxAttempts) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      throw new AppError(429, "otp_too_many_attempts");
    }
    throw badRequest("otp_invalid");
  }

  const consumed = await prisma.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) throw badRequest("otp_invalid");
}
