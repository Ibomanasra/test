import "server-only";
import { prisma } from "@sa/db";

/**
 * Aufräumen (stündlich): abgelaufene Rate-Limit-Zähler, alte OTP-Challenges,
 * abgelaufene oder widerrufene Sessions. Audit-Log und Journale bleiben unangetastet.
 */
export async function cleanupAuthData(now = new Date()): Promise<number> {
  const day = 86_400_000;
  const [buckets, otps, sessions] = await prisma.$transaction([
    prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - day) } } }),
    prisma.otpChallenge.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 7 * day) } } }),
    prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - 30 * day) } }, { revokedAt: { lt: new Date(now.getTime() - 30 * day) } }] } }),
  ]);
  return buckets.count + otps.count + sessions.count;
}
