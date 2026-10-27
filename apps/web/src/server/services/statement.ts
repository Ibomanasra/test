import "server-only";
import { businessDate, startOfBusinessDay } from "@sa/core";
import { prisma } from "@sa/db";

/** Kontoauszug aus dem Kundenjournal (nur anhängen): Anfangssaldo, Bewegungen mit laufendem Saldo, Endsaldo */
export async function customerStatement(customerId: string, fromYmd?: string, toYmd?: string) {
  const today = businessDate(new Date());
  const from = fromYmd && /^\d{4}-\d{2}-\d{2}$/.test(fromYmd) ? fromYmd : `${today.slice(0, 4)}-01-01`;
  const to = toYmd && /^\d{4}-\d{2}-\d{2}$/.test(toYmd) ? toYmd : today;
  const fromDate = startOfBusinessDay(from);
  const toDate = new Date(startOfBusinessDay(to).getTime() + 86_400_000);
  const [before, rows, overdueInvoices] = await Promise.all([
    prisma.customerLedgerEntry.aggregate({ where: { customerId, date: { lt: fromDate } }, _sum: { debit: true, credit: true } }),
    prisma.customerLedgerEntry.findMany({ where: { customerId, date: { gte: fromDate, lt: toDate } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.invoice.findMany({ where: { customerId, status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: new Date() } }, select: { totalGross: true, paidAmount: true, creditedAmount: true } }),
  ]);
  const opening = (before._sum.debit ?? 0) - (before._sum.credit ?? 0);
  let balance = opening;
  const entries = rows.map((r) => {
    balance += r.debit - r.credit;
    return { ...r, balance };
  });
  const overdue = overdueInvoices.reduce((a, i) => a + i.totalGross - i.paidAmount - i.creditedAmount, 0);
  return { from, to, opening, closing: balance, overdue, entries };
}
