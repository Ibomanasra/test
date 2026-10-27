import "server-only";
import { businessDate, startOfBusinessDay } from "@sa/core";
import { prisma } from "@sa/db";

export interface RevenueBucket {
  net: number;
  cost: number;
  margin: number;
  orders: number;
}

/** Umsatz netto (ohne Liefergebühr) und Marge je Kanal für einen Zeitraum – stornierte Mengen ausgenommen */
async function revenue(from: Date, to: Date): Promise<Record<"B2C" | "B2B", RevenueBucket>> {
  const rows = await prisma.$queryRaw<{ channel: "B2C" | "B2B"; net: bigint | null; cost: bigint | null; orders: bigint }[]>`
    SELECT o."channel",
           SUM(CASE WHEN i."qtyBase" > 0 THEN i."lineNet" * (i."qtyBase" - i."qtyCancelledBase") / i."qtyBase" ELSE 0 END)::bigint AS net,
           SUM(i."unitCost" * (i."qtyBase" - i."qtyCancelledBase"))::bigint AS cost,
           COUNT(DISTINCT o.id)::bigint AS orders
    FROM "Order" o JOIN "OrderItem" i ON i."orderId" = o.id
    WHERE o."status" <> 'CANCELLED' AND o."placedAt" >= ${from} AND o."placedAt" < ${to}
    GROUP BY o."channel"`;
  const empty = (): RevenueBucket => ({ net: 0, cost: 0, margin: 0, orders: 0 });
  const out = { B2C: empty(), B2B: empty() };
  for (const r of rows) {
    const net = Number(r.net ?? 0);
    const cost = Number(r.cost ?? 0);
    out[r.channel] = { net, cost, margin: net - cost, orders: Number(r.orders) };
  }
  return out;
}

export async function getDashboardBasics() {
  const now = new Date();
  const today = startOfBusinessDay(businessDate(now));
  const tomorrow = new Date(today.getTime() + 86_400_000);
  // Woche beginnt am Sonntag (Palästina/Israel)
  const dow = new Date(`${businessDate(now)}T12:00:00Z`).getUTCDay();
  const weekStart = new Date(today.getTime() - dow * 86_400_000);
  const monthStart = startOfBusinessDay(`${businessDate(now).slice(0, 7)}-01`);

  const [pendingDealers, customersByType, ordersByStatus, staffCount, revToday, revWeek, revMonth, lowStock, receivables, driverCash] = await Promise.all([
    prisma.customer.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.customer.groupBy({ by: ["type"], orderBy: { type: "asc" }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["status"], orderBy: { status: "asc" }, _count: { _all: true } }),
    prisma.user.count({ where: { kind: "STAFF", isActive: true } }),
    revenue(today, tomorrow),
    revenue(weekStart, tomorrow),
    revenue(monthStart, tomorrow),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "ProductVariant" v
      LEFT JOIN (SELECT "variantId", SUM("onHand" - "reserved") AS avail FROM "StockLevel" GROUP BY "variantId") s ON s."variantId" = v.id
      WHERE v."active" AND COALESCE(s.avail, 0) <= v."minStock"`,
    prisma.customerLedgerEntry.aggregate({ _sum: { debit: true, credit: true } }),
    prisma.cashCollection.aggregate({ where: { closingId: null }, _sum: { amount: true } }),
  ]);
  const count = (g: { _count: true | { _all?: number } | undefined }) => (typeof g._count === "object" ? (g._count._all ?? 0) : 0);
  return {
    pendingDealers,
    customers: Object.fromEntries(customersByType.map((g) => [g.type, count(g)])) as Partial<Record<"B2C" | "B2B", number>>,
    ordersByStatus: Object.fromEntries(ordersByStatus.map((g) => [g.status, count(g)])) as Record<string, number>,
    staffCount,
    revenue: { today: revToday, week: revWeek, month: revMonth },
    lowStock: Number(lowStock[0]?.n ?? 0),
    receivables: (receivables._sum.debit ?? 0) - (receivables._sum.credit ?? 0),
    driverCash: driverCash._sum.amount ?? 0,
  };
}
