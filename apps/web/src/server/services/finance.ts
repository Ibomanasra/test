import "server-only";
import { agingBucket, agingSummary, allocatePayment, businessDate, daysOverdue, documentTotals, invoiceOpenAmount, invoiceStatusFor, nextDunningLevel } from "@sa/core";
import type { dunningRunSchema, paymentCreateSchema, returnCreateSchema } from "@sa/contracts";
import { allocateDocumentNumber, prisma, type Prisma, type Tx } from "@sa/db";
import type { z } from "zod";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, notFound } from "../errors";
import { archiveFiscalDocument, createCreditNote } from "./invoicing";
import { defaultWarehouseId, lockStock } from "./stock";

/**
 * Finanzen (Phase 5): Zahlungen mit Zuordnung, offene Posten, Mahnungen, Retouren.
 * Kundenjournal ist nur-anhängen: Storno = Gegenbuchung.
 */

const OPEN_STATUSES = ["ISSUED", "PARTIALLY_PAID"] as const;

async function syncOrderPaymentStatus(tx: Tx, orderIds: string[]) {
  for (const orderId of new Set(orderIds)) {
    const invs = await tx.invoice.findMany({ where: { orderId }, select: { totalGross: true, paidAmount: true, creditedAmount: true } });
    if (!invs.length) continue;
    const open = invs.reduce((a, i) => a + invoiceOpenAmount(i), 0);
    const paid = invs.some((i) => i.paidAmount > 0);
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, items: { select: { qtyBase: true, qtyCancelledBase: true, qtyDeliveredBase: true } } } });
    const fullyInvoiced = order?.items.every((i) => i.qtyDeliveredBase + i.qtyCancelledBase >= i.qtyBase) ?? false;
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: open === 0 && fullyInvoiced ? "PAID" : paid ? "PARTIALLY_PAID" : "UNPAID" } });
  }
}

/** Zahlung erfassen (Quittung RC-…), auf offene Rechnungen verteilen, Journal buchen */
export async function recordPayment(ctx: AuthContext, input: z.infer<typeof paymentCreateSchema>, outerTx?: Tx) {
  const run = async (tx: Tx) => {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${input.customerId} FOR UPDATE`;
    const customer = await tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
    if (!customer) throw notFound();
    const open = await tx.invoice.findMany({ where: { customerId: input.customerId, status: { in: [...OPEN_STATUSES] } }, select: { id: true, orderId: true, dueDate: true, totalGross: true, paidAmount: true, creditedAmount: true } });
    const { allocations, unallocated } = allocatePayment(
      input.amount,
      open.map((i) => ({ id: i.id, dueDate: i.dueDate, open: invoiceOpenAmount(i) })),
      input.invoiceIds,
    );
    const receivedAt = input.receivedAt ?? new Date();
    const { number } = await allocateDocumentNumber(tx, "RECEIPT", receivedAt);
    const payment = await tx.payment.create({
      data: { number, customerId: input.customerId, method: input.method, amount: input.amount, receivedAt, reference: input.reference, note: input.note, receivedById: ctx.user.id, allocations: { create: allocations } },
    });
    for (const a of allocations) {
      const inv = open.find((i) => i.id === a.invoiceId)!;
      const paidAmount = inv.paidAmount + a.amount;
      await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount, status: invoiceStatusFor({ totalGross: inv.totalGross, paidAmount, creditedAmount: inv.creditedAmount }) } });
    }
    await tx.customerLedgerEntry.create({ data: { customerId: input.customerId, type: "PAYMENT", refId: payment.id, refNumber: number, date: receivedAt, credit: input.amount, note: input.reference ?? undefined } });
    await syncOrderPaymentStatus(tx, allocations.map((a) => open.find((i) => i.id === a.invoiceId)!.orderId).filter((x): x is string => !!x));
    await audit(ctx, { action: "payment.record", entityType: "Payment", entityId: payment.id, after: { number, amount: input.amount, method: input.method, allocations, unallocated } }, tx);
    return { id: payment.id, number, allocations, unallocated };
  };
  return outerTx ? run(outerTx) : prisma.$transaction(run, { timeout: 20_000 });
}

/** Zahlung stornieren: Zuordnungen zurücknehmen, Gegenbuchung im Journal */
export async function voidPayment(ctx: AuthContext, id: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id }, include: { allocations: { include: { invoice: true } }, cashCollection: true } });
    if (!p) throw notFound();
    if (p.voidedAt) throw new AppError(409, "already_voided");
    if (p.cashCollection?.closingId) throw new AppError(409, "cash_already_closed");
    for (const a of p.allocations) {
      const paidAmount = a.invoice.paidAmount - a.amount;
      await tx.invoice.update({ where: { id: a.invoiceId }, data: { paidAmount, status: invoiceStatusFor({ totalGross: a.invoice.totalGross, paidAmount, creditedAmount: a.invoice.creditedAmount }) } });
    }
    await tx.paymentAllocation.deleteMany({ where: { paymentId: id } });
    if (p.cashCollection) await tx.cashCollection.delete({ where: { id: p.cashCollection.id } });
    await tx.payment.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason } });
    await tx.customerLedgerEntry.create({ data: { customerId: p.customerId, type: "ADJUSTMENT", refId: p.id, refNumber: p.number, date: new Date(), debit: p.amount, note: `void: ${reason}` } });
    await syncOrderPaymentStatus(tx, p.allocations.map((a) => a.invoice.orderId).filter((x): x is string => !!x));
    await audit(ctx, { action: "payment.void", entityType: "Payment", entityId: id, before: { amount: p.amount }, after: { reason } }, tx);
  });
}

export const FINANCE_PAGE_SIZE = 50;

export async function listPayments(f: { q?: string; page: number }) {
  const q = f.q?.trim();
  const where: Prisma.PaymentWhereInput = q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }, { customer: { displayName: { contains: q, mode: "insensitive" } } }] } : {};
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where, orderBy: { receivedAt: "desc" }, skip: (f.page - 1) * FINANCE_PAGE_SIZE, take: FINANCE_PAGE_SIZE, include: { customer: { select: { id: true, displayName: true } }, receivedBy: { select: { name: true } }, allocations: { include: { invoice: { select: { number: true } } } } } }),
    prisma.payment.count({ where }),
  ]);
  return { items, total, pageSize: FINANCE_PAGE_SIZE };
}

/** Offene Posten je Kunde mit Altersstruktur */
export async function openItems(today = new Date()) {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: [...OPEN_STATUSES] } },
    orderBy: { dueDate: "asc" },
    select: { id: true, number: true, issueDate: true, dueDate: true, totalGross: true, paidAmount: true, creditedAmount: true, customer: { select: { id: true, displayName: true, number: true, type: true } } },
  });
  const rows = invoices.map((i) => ({ ...i, open: invoiceOpenAmount(i), bucket: agingBucket(i.dueDate, today), days: daysOverdue(i.dueDate, today) })).filter((i) => i.open > 0);
  const byCustomer = new Map<string, { customer: (typeof rows)[number]["customer"]; items: typeof rows }>();
  for (const r of rows) {
    const e = byCustomer.get(r.customer.id) ?? { customer: r.customer, items: [] };
    e.items.push(r);
    byCustomer.set(r.customer.id, e);
  }
  const customers = [...byCustomer.values()].map((c) => ({ ...c, summary: agingSummary(c.items, today), oldestDays: Math.max(...c.items.map((i) => i.days)) })).sort((a, b) => b.summary.total - a.summary.total);
  return { customers, summary: agingSummary(rows, today), rows };
}

/** Mahnlauf: je Kunde mit überfälligen Rechnungen die nächste Stufe (1–3) erzeugen */
export async function runDunning(ctx: AuthContext, input: z.infer<typeof dunningRunSchema>) {
  const today = new Date();
  const { customers } = await openItems(today);
  const created: { id: string; number: string; customer: string; level: number }[] = [];
  for (const c of customers) {
    if (input.customerIds?.length && !input.customerIds.includes(c.customer.id)) continue;
    const overdue = c.items.filter((i) => i.days > 0);
    if (!overdue.length) continue;
    const last = await prisma.dunningNotice.findFirst({ where: { customerId: c.customer.id }, orderBy: { issuedAt: "desc" }, select: { level: true, issuedAt: true } });
    const level = nextDunningLevel(Math.max(...overdue.map((i) => i.days)), last, today);
    if (!level) continue;
    const notice = await prisma.$transaction(async (tx) => {
      const { number } = await allocateDocumentNumber(tx, "DUNNING");
      const fee = level >= 2 ? input.feeAgorot : 0;
      const n = await tx.dunningNotice.create({
        data: { number, customerId: c.customer.id, level, feeAgorot: fee, dueBy: new Date(today.getTime() + 7 * 86_400_000), invoices: { create: overdue.map((i) => ({ invoiceId: i.id, openAmount: i.open })) } },
      });
      if (fee > 0) await tx.customerLedgerEntry.create({ data: { customerId: c.customer.id, type: "DUNNING_FEE", refId: n.id, refNumber: number, date: today, debit: fee } });
      await audit(ctx, { action: "dunning.issue", entityType: "DunningNotice", entityId: n.id, after: { number, level, invoices: overdue.length, fee } }, tx);
      return n;
    });
    created.push({ id: notice.id, number: notice.number, customer: c.customer.displayName, level });
  }
  return { created };
}

export function listDunningNotices() {
  return prisma.dunningNotice.findMany({ orderBy: { issuedAt: "desc" }, take: 100, include: { customer: { select: { id: true, displayName: true } }, invoices: { select: { openAmount: true } } } });
}

// ---------------------------------------------------------------------------
// Retouren
// ---------------------------------------------------------------------------

/** Retoure: Ware zurück (optional ins Lager), Gutschrift je betroffener Rechnung */
export async function createReturn(ctx: AuthContext, input: z.infer<typeof returnCreateSchema>) {
  const result = await prisma.$transaction(
    async (tx) => {
      const o = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { items: { include: { returnItems: true } }, invoices: { where: { status: { not: "CREDITED" } }, orderBy: { number: "asc" }, include: { lines: true, creditNotes: { include: { lines: true } } } } },
      });
      if (!o) throw notFound();
      for (const r of input.items) {
        const item = o.items.find((i) => i.id === r.orderItemId);
        if (!item) throw badRequest("invalid_item");
        const returned = item.returnItems.reduce((a, x) => a + x.qtyBase, 0);
        if (r.qtyBase + returned > item.qtyDeliveredBase) throw badRequest("return_exceeds_delivered", { sku: item.skuSnapshot });
      }
      const { number } = await allocateDocumentNumber(tx, "RETURN");
      const ret = await tx.return.create({ data: { number, orderId: o.id, customerId: o.customerId, status: "RECEIVED", restock: input.restock, reason: input.reason, items: { create: input.items } } });
      if (input.restock) {
        const warehouseId = await defaultWarehouseId(tx);
        await lockStock(tx, warehouseId, input.items.map((r) => o.items.find((i) => i.id === r.orderItemId)!.variantId));
        for (const r of input.items) {
          const item = o.items.find((i) => i.id === r.orderItemId)!;
          await tx.stockLevel.update({ where: { variantId_warehouseId: { variantId: item.variantId, warehouseId } }, data: { onHand: { increment: r.qtyBase } } });
          await tx.stockMovement.create({ data: { variantId: item.variantId, warehouseId, type: "RETURN", qtyBase: r.qtyBase, unitCost: item.unitCost, refType: "Return", refId: ret.id, note: number, createdById: ctx.user.id } });
        }
      }
      // Rückgabemengen auf Rechnungszeilen verteilen (je Rechnung eine Gutschrift)
      const perInvoice = new Map<string, { invoiceLineId: string; qtyBase: number }[]>();
      for (const r of input.items) {
        let rest = r.qtyBase;
        for (const inv of o.invoices) {
          for (const line of inv.lines.filter((l) => l.orderItemId === r.orderItemId)) {
            const credited = inv.creditNotes.flatMap((c) => c.lines).filter((l) => l.invoiceLineId === line.id).reduce((a, l) => a + l.qtyBase, 0);
            const take = Math.min(rest, line.qtyBase - credited);
            if (take <= 0) continue;
            perInvoice.set(inv.id, [...(perInvoice.get(inv.id) ?? []), { invoiceLineId: line.id, qtyBase: take }]);
            rest -= take;
            if (rest === 0) break;
          }
          if (rest === 0) break;
        }
      }
      const notes: { id: string; number: string; totalGross: number }[] = [];
      let first = true;
      for (const [invoiceId, lines] of perInvoice) {
        const cn = await createCreditNote(ctx, invoiceId, { reason: `${number}: ${input.reason}`, lines, returnId: first ? ret.id : null }, tx);
        notes.push({ id: cn.id, number: cn.number, totalGross: cn.totalGross });
        first = false;
      }
      await audit(ctx, { action: "return.create", entityType: "Return", entityId: ret.id, after: { number, items: input.items.length, restock: input.restock, creditNotes: notes.map((n) => n.number) } }, tx);
      return { id: ret.id, number, creditNotes: notes };
    },
    { timeout: 30_000 },
  );
  for (const cn of result.creditNotes) void archiveFiscalDocument("CREDIT_NOTE", cn.id, ctx.user.id).catch((err: unknown) => console.error("[archive]", err));
  return { ...result, total: documentTotals(result.creditNotes.map((c) => ({ net: 0, vat: 0, gross: c.totalGross }))).gross };
}

export function listReturns() {
  return prisma.return.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { customer: { select: { displayName: true } }, order: { select: { id: true, number: true } }, creditNote: { select: { id: true, number: true, totalGross: true } }, _count: { select: { items: true } } } });
}

// ---------------------------------------------------------------------------
// Exporte für den Steuerberater
// ---------------------------------------------------------------------------

export async function exportRows(kind: "invoices" | "credit-notes" | "payments" | "ledger", from: Date, to: Date) {
  const range = { gte: from, lt: new Date(to.getTime() + 86_400_000) };
  if (kind === "invoices") {
    const rows = await prisma.invoice.findMany({ where: { issueDate: range }, orderBy: { number: "asc" }, include: { customer: { select: { number: true, displayName: true, dealerNumber: true } } } });
    return {
      columns: [
        { key: "number", header: "number" },
        { key: "date", header: "date" },
        { key: "due", header: "due_date" },
        { key: "customer_no", header: "customer_no" },
        { key: "customer", header: "customer", width: 30 },
        { key: "dealer", header: "buyer_dealer_no" },
        { key: "channel", header: "channel" },
        { key: "method", header: "payment_method" },
        { key: "net", header: "net", money: true },
        { key: "vat", header: "vat", money: true },
        { key: "gross", header: "gross", money: true },
        { key: "paid", header: "paid", money: true },
        { key: "credited", header: "credited", money: true },
        { key: "status", header: "status" },
      ],
      rows: rows.map((i) => ({ number: i.number, date: businessDate(i.issueDate), due: businessDate(i.dueDate), customer_no: i.customer.number, customer: i.customer.displayName, dealer: i.customer.dealerNumber ?? "", channel: i.channel, method: i.paymentMethod, net: i.subtotalNet, vat: i.vatTotal, gross: i.totalGross, paid: i.paidAmount, credited: i.creditedAmount, status: i.status })),
    };
  }
  if (kind === "credit-notes") {
    const rows = await prisma.creditNote.findMany({ where: { issueDate: range }, orderBy: { number: "asc" }, include: { invoice: { select: { number: true } }, customer: { select: { number: true, displayName: true } } } });
    return {
      columns: [
        { key: "number", header: "number" },
        { key: "date", header: "date" },
        { key: "invoice", header: "invoice" },
        { key: "customer_no", header: "customer_no" },
        { key: "customer", header: "customer", width: 30 },
        { key: "reason", header: "reason", width: 30 },
        { key: "net", header: "net", money: true },
        { key: "vat", header: "vat", money: true },
        { key: "gross", header: "gross", money: true },
      ],
      rows: rows.map((c) => ({ number: c.number, date: businessDate(c.issueDate), invoice: c.invoice.number, customer_no: c.customer.number, customer: c.customer.displayName, reason: c.reason, net: c.subtotalNet, vat: c.vatTotal, gross: c.totalGross })),
    };
  }
  if (kind === "payments") {
    const rows = await prisma.payment.findMany({ where: { receivedAt: range }, orderBy: { number: "asc" }, include: { customer: { select: { number: true, displayName: true } }, allocations: { include: { invoice: { select: { number: true } } } } } });
    return {
      columns: [
        { key: "number", header: "number" },
        { key: "date", header: "date" },
        { key: "customer_no", header: "customer_no" },
        { key: "customer", header: "customer", width: 30 },
        { key: "method", header: "method" },
        { key: "reference", header: "reference" },
        { key: "amount", header: "amount", money: true },
        { key: "invoices", header: "invoices", width: 30 },
        { key: "voided", header: "voided" },
      ],
      rows: rows.map((p) => ({ number: p.number, date: businessDate(p.receivedAt), customer_no: p.customer.number, customer: p.customer.displayName, method: p.method, reference: p.reference ?? "", amount: p.amount, invoices: p.allocations.map((a) => a.invoice.number).join(" "), voided: p.voidedAt ? "yes" : "" })),
    };
  }
  const rows = await prisma.customerLedgerEntry.findMany({ where: { date: range }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], include: { customer: { select: { number: true, displayName: true } } } });
  return {
    columns: [
      { key: "date", header: "date" },
      { key: "customer_no", header: "customer_no" },
      { key: "customer", header: "customer", width: 30 },
      { key: "type", header: "type" },
      { key: "ref", header: "reference" },
      { key: "debit", header: "debit", money: true },
      { key: "credit", header: "credit", money: true },
      { key: "note", header: "note", width: 30 },
    ],
    rows: rows.map((e) => ({ date: businessDate(e.date), customer_no: e.customer.number, customer: e.customer.displayName, type: e.type, ref: e.refNumber ?? "", debit: e.debit, credit: e.credit, note: e.note ?? "" })),
  };
}
