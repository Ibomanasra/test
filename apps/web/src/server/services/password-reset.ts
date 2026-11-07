import "server-only";
import { normalizePhone } from "@sa/core";
import { prisma } from "@sa/db";
import { createHash } from "node:crypto";
import { sendMail } from "../adapters/mail";
import { audit } from "../audit";
import { hashPassword } from "../auth/password";
import { hitRateLimit } from "../auth/rate-limit";
import { revokeAllSessions } from "../auth/session";
import { signTicket, verifyTicket } from "../crypto";
import { env } from "../env";
import { badRequest } from "../errors";

/**
 * Passwort vergessen (Mitarbeiter und Kunden mit E-Mail): Link per E-Mail, 30 Minuten gültig, einmalig –
 * das Ticket enthält einen Fingerabdruck des alten Hashs und wird nach der Änderung ungültig.
 * Antwort ist immer gleich (keine Auskunft, ob Nummer/E-Mail existiert).
 */

const TTL_SECONDS = 30 * 60;
const fingerprint = (hash: string | null) => createHash("sha256").update(hash ?? "none").digest("hex").slice(0, 16);

export async function requestPasswordReset(identifier: string, ip: string | null, locale: "ar" | "en" | "he") {
  await hitRateLimit(`pwreset:ip:${ip ?? "unknown"}`, 10, 3600);
  const id = identifier.trim();
  let phone: string | null = null;
  try {
    phone = normalizePhone(id);
  } catch {
    phone = null;
  }
  const user = await prisma.user.findFirst({
    where: { isActive: true, OR: [...(phone ? [{ phone }] : []), { email: id.toLowerCase() }, { username: id.toLowerCase(), kind: "STAFF" }] },
  });
  if (!user?.email) return { ok: true };
  await hitRateLimit(`pwreset:user:${user.id}`, 3, 3600);
  const token = signTicket({ uid: user.id, fp: fingerprint(user.passwordHash), kind: "pwreset" }, TTL_SECONDS);
  const path = user.kind === "STAFF" ? "admin/reset-password" : "reset-password";
  const link = `${env().APP_URL}/${locale}/${path}?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: locale === "ar" ? "إعادة تعيين كلمة المرور – شعلة الجنوب" : "Password reset – Sholat Aljanoub",
    text:
      locale === "ar"
        ? `مرحباً ${user.name}،\n\nلإعادة تعيين كلمة المرور افتح الرابط التالي خلال 30 دقيقة:\n${link}\n\nإذا لم تطلب ذلك فتجاهل هذه الرسالة.`
        : `Hello ${user.name},\n\nOpen this link within 30 minutes to set a new password:\n${link}\n\nIf you did not request this, ignore this email.`,
  });
  await audit({ user: { id: user.id } }, { action: "auth.password_reset_requested", entityType: "User", entityId: user.id });
  return { ok: true };
}

export async function confirmPasswordReset(token: string, password: string) {
  const t = verifyTicket<{ uid: string; fp: string; kind: string }>(token);
  if (!t || t.kind !== "pwreset" || t.exp < Date.now()) throw badRequest("invalid_reset_token");
  const user = await prisma.user.findUnique({ where: { id: t.uid } });
  if (!user || !user.isActive || fingerprint(user.passwordHash) !== t.fp) throw badRequest("invalid_reset_token");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  await revokeAllSessions(user.id);
  await audit({ user: { id: user.id } }, { action: "auth.password_reset", entityType: "User", entityId: user.id });
  return { ok: true };
}
