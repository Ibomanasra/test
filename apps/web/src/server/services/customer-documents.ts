import "server-only";
import { prisma } from "@sa/db";

export type CustomerDocKind = "ORDER_CONFIRMATION" | "DELIVERY_NOTE" | "INVOICE" | "CREDIT_NOTE" | "RECEIPT" | "QUOTE";

/** Alle Belege eines Kunden (A4-PDF über /api/v1/documents/…) */
export async function customerDocuments(customerId: string) {
  const [orders, shipments, invoices, creditNotes, payments, quotes] = await Promise.all([
    prisma.order.findMany({ where: { customerId }, select: { id: true, number: true, placedAt: true }, orderBy: { placedAt: "desc" }, take: 200 }),
    prisma.shipment.findMany({ where: { order: { customerId } }, select: { id: true, number: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.invoice.findMany({ where: { customerId }, select: { id: true, number: true, issueDate: true }, orderBy: { issueDate: "desc" }, take: 200 }),
    prisma.creditNote.findMany({ where: { customerId }, select: { id: true, number: true, issueDate: true }, orderBy: { issueDate: "desc" }, take: 200 }),
    prisma.payment.findMany({ where: { customerId, voidedAt: null }, select: { id: true, number: true, receivedAt: true }, orderBy: { receivedAt: "desc" }, take: 200 }),
    prisma.quote.findMany({ where: { customerId, status: { in: ["SENT", "ACCEPTED", "CONVERTED"] } }, select: { id: true, number: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const docs = [
    ...invoices.map((d) => ({ kind: "INVOICE" as const, id: d.id, number: d.number, date: d.issueDate })),
    ...creditNotes.map((d) => ({ kind: "CREDIT_NOTE" as const, id: d.id, number: d.number, date: d.issueDate })),
    ...payments.map((d) => ({ kind: "RECEIPT" as const, id: d.id, number: d.number, date: d.receivedAt })),
    ...shipments.map((d) => ({ kind: "DELIVERY_NOTE" as const, id: d.id, number: d.number, date: d.createdAt })),
    ...orders.map((d) => ({ kind: "ORDER_CONFIRMATION" as const, id: d.id, number: d.number, date: d.placedAt })),
    ...quotes.map((d) => ({ kind: "QUOTE" as const, id: d.id, number: d.number, date: d.createdAt })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  return docs.map((d) => ({ ...d, href: `/api/v1/documents/${d.kind.toLowerCase().replace(/_/g, "-")}/${d.id}` }));
}
