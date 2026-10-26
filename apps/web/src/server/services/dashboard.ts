import "server-only";
import { prisma } from "@sa/db";

/** Kennzahlen, die schon in Phase 1 verfügbar sind (Umsatz/Marge folgen mit Bestellungen in Phase 3). */
export async function getDashboardBasics() {
  const [pendingDealers, customersByType, ordersByStatus, staffCount] = await prisma.$transaction([
    prisma.customer.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.customer.groupBy({ by: ["type"], orderBy: { type: "asc" }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["status"], orderBy: { status: "asc" }, _count: { _all: true } }),
    prisma.user.count({ where: { kind: "STAFF", isActive: true } }),
  ]);
  const count = (g: { _count: true | { _all?: number } | undefined }) =>
    typeof g._count === "object" ? (g._count._all ?? 0) : 0;
  return {
    pendingDealers,
    customers: Object.fromEntries(customersByType.map((g) => [g.type, count(g)])) as Partial<Record<"B2C" | "B2B", number>>,
    ordersByStatus: Object.fromEntries(ordersByStatus.map((g) => [g.status, count(g)])) as Record<string, number>,
    staffCount,
  };
}
