import "server-only";
import { prisma, type SessionClient, type UserKind } from "@sa/db";
import { cookies, headers } from "next/headers";
import { randomToken, sha256 } from "../crypto";
import { env } from "../env";

export const SESSION_COOKIE = "sa_session";
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function ttlDays(kind: UserKind): number {
  const e = env();
  return kind === "STAFF" ? e.SESSION_TTL_DAYS_STAFF : e.SESSION_TTL_DAYS_CUSTOMER;
}

export interface CreateSessionInput {
  userId: string;
  kind: UserKind;
  client: SessionClient;
  mfaPassed: boolean;
  ip?: string;
  userAgent?: string;
}

/** Legt eine Session an. Gespeichert wird nur der SHA-256-Hash des Tokens. */
export async function createSession(input: CreateSessionInput): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlDays(input.kind) * 86_400_000);
  await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: sha256(token),
      client: input.client,
      mfaPassed: input.mfaPassed,
      ip: input.ip,
      userAgent: input.userAgent,
      expiresAt,
    },
  });
  await prisma.user.update({ where: { id: input.userId }, data: { lastLoginAt: new Date() } });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Token aus Cookie (Web) oder "Authorization: Bearer" (Mobile-App). */
export async function readSessionToken(): Promise<{ token: string; via: "cookie" | "bearer" } | null> {
  const auth = (await headers()).get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return { token, via: "bearer" };
  }
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  return cookie ? { token: cookie, via: "cookie" } : null;
}

export async function loadSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          roles: { include: { role: { select: { key: true, permissions: true } } } },
          memberships: {
            include: {
              customer: {
                select: { id: true, type: true, status: true, displayName: true, number: true, groupId: true },
              },
            },
          },
        },
      },
    },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) return null;

  const now = Date.now();
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Gleitende Verlängerung für Kunden, feste Laufzeit für Mitarbeiter
    const data: { lastSeenAt: Date; expiresAt?: Date } = { lastSeenAt: new Date(now) };
    if (session.user.kind === "CUSTOMER") data.expiresAt = new Date(now + ttlDays("CUSTOMER") * 86_400_000);
    await prisma.session.update({ where: { id: session.id }, data }).catch(() => undefined);
  }
  return session;
}

export type LoadedSession = NonNullable<Awaited<ReturnType<typeof loadSession>>>;

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
