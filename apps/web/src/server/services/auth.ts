import "server-only";
import { isValidPhone, normalizePhone } from "@sa/core";
import { prisma, type Locale, type SessionClient } from "@sa/db";
import { requestOtp, verifyOtp } from "../auth/otp";
import { verifyPassword } from "../auth/password";
import { hitRateLimit, resetRateLimit } from "../auth/rate-limit";
import { createSession } from "../auth/session";
import { signTicket, verifyTicket } from "../crypto";
import { env } from "../env";
import { AppError, forbidden, unauthorized } from "../errors";

export const REGISTRATION_TICKET_TTL = 30 * 60;
const STAFF_TICKET_TTL = 10 * 60;

interface ClientMeta {
  ip: string;
  userAgent?: string;
  client: SessionClient;
}

export type CustomerVerifyResult =
  | { status: "logged_in"; token: string; expiresAt: Date }
  | { status: "needs_registration"; registrationToken: string };

/**
 * Kunden-Login per OTP. Unbekannte Nummer → signiertes Registrierungs-Ticket
 * (die Nummer ist damit bewiesen, Registrierung folgt im nächsten Schritt).
 */
export async function verifyCustomerOtp(phone: string, code: string, meta: ClientMeta): Promise<CustomerVerifyResult> {
  await verifyOtp(phone, "LOGIN", code, meta.ip);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return { status: "needs_registration", registrationToken: signTicket({ phone, kind: "register" }, REGISTRATION_TICKET_TTL) };
  }
  if (user.kind === "STAFF") throw forbidden("use_staff_login");
  if (!user.isActive) throw forbidden("account_disabled");
  if (!user.phoneVerifiedAt) await prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
  const s = await createSession({ userId: user.id, kind: "CUSTOMER", mfaPassed: true, ...meta });
  return { status: "logged_in", ...s };
}

export function readRegistrationTicket(token: string): string {
  const t = verifyTicket<{ phone: string; kind: string }>(token);
  if (!t || t.kind !== "register" || typeof t.phone !== "string") throw new AppError(400, "registration_expired");
  return t.phone;
}

/** Mitarbeiter über Benutzername (bevorzugt) oder Telefonnummer finden */
async function findStaffByLogin(login: string) {
  const l = login.trim().toLowerCase();
  const byUsername = await prisma.user.findUnique({ where: { username: l } });
  if (byUsername) return byUsername;
  return isValidPhone(l) ? prisma.user.findUnique({ where: { phone: normalizePhone(l) } }) : null;
}

/**
 * Mitarbeiter-Login: Benutzername + Passwort.
 * Standard: sofort angemeldet. Mit STAFF_LOGIN_OTP=true zusätzlich SMS-Code an die hinterlegte Nummer (Schritt 2).
 */
export async function startStaffLogin(login: string, password: string, meta: ClientMeta, locale: Locale) {
  const key = login.trim().toLowerCase();
  await hitRateLimit(`staff-login:login:${key}`, 10, 900);
  await hitRateLimit(`staff-login:ip:${meta.ip}`, 30, 900);
  const user = await findStaffByLogin(login);
  const ok = await verifyPassword(user?.kind === "STAFF" ? user.passwordHash : null, password);
  if (!user || !ok || user.kind !== "STAFF") throw unauthorized("invalid_credentials");
  if (!user.isActive) throw forbidden("account_disabled");
  await resetRateLimit(`staff-login:login:${key}`);
  if (!env().STAFF_LOGIN_OTP) {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
    return { session: await createSession({ userId: user.id, kind: "STAFF", mfaPassed: true, ...meta }) };
  }
  await requestOtp({ phone: user.phone, purpose: "LOGIN", ip: meta.ip, locale: user.locale ?? locale });
  return { ticket: signTicket({ uid: user.id, kind: "staff-mfa" }, STAFF_TICKET_TTL) };
}

/** Mitarbeiter-Login Schritt 2: OTP + Ticket aus Schritt 1 → Session mit 2. Faktor. */
export async function finishStaffLogin(ticket: string, code: string, meta: ClientMeta) {
  const t = verifyTicket<{ uid: string; kind: string }>(ticket);
  if (!t || t.kind !== "staff-mfa") throw unauthorized("login_expired");
  const user = await prisma.user.findUnique({ where: { id: t.uid } });
  if (!user || user.kind !== "STAFF" || !user.isActive) throw unauthorized("invalid_credentials");
  await verifyOtp(user.phone, "LOGIN", code, meta.ip);
  return createSession({ userId: user.id, kind: "STAFF", mfaPassed: true, ...meta });
}
