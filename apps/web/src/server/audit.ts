import "server-only";
import { prisma, type Prisma, type Tx } from "@sa/db";
import { getRequestMeta } from "./request-meta";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

const SECRET_KEYS = new Set(["passwordHash", "password", "codeHash", "tokenHash"]);

/** Entfernt Geheimnisse und macht Werte JSON-tauglich (Date → ISO). */
function sanitize(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(value, (key, v) => (SECRET_KEYS.has(key) ? "[redacted]" : typeof v === "bigint" ? v.toString() : v)),
  ) as Prisma.InputJsonValue;
}

/**
 * Schreibt einen Audit-Eintrag (wer, was, wann, vorher/nachher).
 * Mit `tx` innerhalb der fachlichen Transaktion → Audit und Änderung sind atomar.
 */
export async function audit(ctx: { user: { id: string } } | null, entry: AuditEntry, tx?: Tx): Promise<void> {
  const meta = await getRequestMeta().catch(() => null);
  await (tx ?? prisma).auditLog.create({
    data: {
      actorId: ctx?.user.id ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: sanitize(entry.before),
      after: sanitize(entry.after),
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    },
  });
}
