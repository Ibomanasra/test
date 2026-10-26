import "server-only";
import { prisma, type Prisma } from "@sa/db";

export const AUDIT_PAGE_SIZE = 50;

export interface AuditFilter {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  page: number;
}

export async function listAudit(f: AuditFilter) {
  const where: Prisma.AuditLogWhereInput = {
    entityType: f.entityType || undefined,
    entityId: f.entityId || undefined,
    actorId: f.actorId || undefined,
    action: f.action ? { startsWith: f.action } : undefined,
  };
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { actor: { select: { name: true, phone: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, pageSize: AUDIT_PAGE_SIZE };
}
