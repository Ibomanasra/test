import "server-only";
import {
  effectiveChannel,
  hasPermission,
  mergeRolePermissions,
  type ChannelKey,
  type Permission,
} from "@sa/core";
import { cache } from "react";
import { forbidden, unauthorized } from "../errors";
import { loadSession, readSessionToken, type LoadedSession } from "./session";

export interface CustomerRef {
  id: string;
  number: string;
  type: "B2C" | "B2B";
  status: "ACTIVE" | "PENDING_APPROVAL" | "REJECTED" | "BLOCKED";
  displayName: string;
  groupId: string | null;
  memberRole: "OWNER" | "BUYER";
}

export interface AuthContext {
  sessionId: string;
  via: "cookie" | "bearer";
  user: { id: string; kind: "STAFF" | "CUSTOMER"; name: string; phone: string; locale: "ar" | "en" };
  /** Nur STAFF mit bestandenem 2. Faktor erhält Rechte */
  permissions: ReadonlySet<string>;
  roleKeys: string[];
  customer: CustomerRef | null;
  /** Wirksamer Preiskanal – B2B nur für freigegebene Händler (D13) */
  channel: ChannelKey;
  isStaff: boolean;
}

function toContext(session: LoadedSession, via: "cookie" | "bearer"): AuthContext {
  const { user } = session;
  const isStaff = user.kind === "STAFF" && session.mfaPassed;
  const membership = user.memberships[0];
  const customer: CustomerRef | null =
    user.kind === "CUSTOMER" && membership
      ? { ...membership.customer, memberRole: membership.role }
      : null;
  return {
    sessionId: session.id,
    via,
    user: { id: user.id, kind: user.kind, name: user.name, phone: user.phone, locale: user.locale },
    permissions: isStaff ? mergeRolePermissions(user.roles.map((r) => r.role)) : new Set<string>(),
    roleKeys: isStaff ? user.roles.map((r) => r.role.key) : [],
    customer,
    channel: effectiveChannel(customer ? { customerType: customer.type, customerStatus: customer.status } : null),
    isStaff,
  };
}

/** Aktueller Benutzer (pro Request gecacht) oder null. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const t = await readSessionToken();
  if (!t) return null;
  const session = await loadSession(t.token);
  return session ? toContext(session, t.via) : null;
});

export function can(ctx: AuthContext | null, permission: Permission): boolean {
  return !!ctx?.isStaff && hasPermission(ctx.permissions, permission);
}

/** Für API-Handler: wirft 401/403. */
export async function requireStaff(...permissions: Permission[]): Promise<AuthContext> {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  if (!ctx.isStaff) throw forbidden();
  for (const p of permissions) if (!hasPermission(ctx.permissions, p)) throw forbidden();
  return ctx;
}

export async function requireCustomer(): Promise<AuthContext & { customer: CustomerRef }> {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  if (!ctx.customer) throw forbidden();
  return ctx as AuthContext & { customer: CustomerRef };
}
