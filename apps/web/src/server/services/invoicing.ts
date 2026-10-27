import "server-only";
import { creditLine, deliveryFeeLine, documentTotals, dueDateFor, invoiceStatusFor, shippedLine, type PricingChannel } from "@sa/core";
import { allocateDocumentNumber, prisma, type DocLanguage, type Prisma, type Tx } from "@sa/db";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, notFound } from "../errors";
import { storeFile } from "../adapters/storage";

/**
 * Rechnungen & Gutschriften (D23):
 *  - Eine Rechnung je Lieferschein, ausgestellt beim Übergang „Unterwegs“ in DERSELBEN
 *    Transaktion wie Lieferschein und Warenausgang → lückenlose INV-Nummern.
 *  - Verkäufer- und Kundendaten werden als Snapshot gespeichert; Rechnung und Gutschrift
 *    sind per DB-Trigger unveränderlich, Korrektur nur per Gutschrift.
 *  - Nach dem Commit wird das PDF erzeugt und eingefroren archiviert (Job holt Fehlschläge nach).
 */

export interface SellerSnapshot {
  nameAr: string;
  nameEn: string;
  addressAr: string;
  addressEn: string;
  phone: string;
  email: string | null;
  website: string | null;
  dealerNumber: string;
  taxFileNumber: string | null;
  taxInvoiceFields: Record<string, unknown>;
  banks: { bankNameAr: string; bankNameEn: string; branch: string | null; accountName: string; accountNo: string; iban: string | null; swift: string | null }[];
}

export interface CustomerSnapshot {
  number: string;
  type: "B2C" | "B2B";
  displayName: string;
  companyName: string | null;
  ownerName: string | null;
  dealerNumber: string | null;
  phone: string | null;
  address: { recipient?: string; phone?: string; city?: string; street?: string | null; details?: string | null; zoneAr?: string; zoneEn?: string } | null;
}

export async function sellerSnapshot(tx: Tx | typeof prisma = prisma): Promise<SellerSnapshot> {
  const [c, banks] = await Promise.all([
    tx.companySettings.findUniqueOrThrow({ where: { id: 1 } }),
    tx.bankAccount.findMany({ where: { active: true, showOnDocs: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return {
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    addressAr: c.addressAr,
    addressEn: c.addressEn,
    phone: c.phone,
    email: c.email,
    website: c.website,
    dealerNumber: c.dealerNumber,
    taxFileNumber: c.taxFileNumber,
    taxInvoiceFields: (c.taxInvoiceFields ?? {}) as Record<string, unknown>,
    banks: banks.map((b) => ({ bankNameAr: b.bankNameAr, bankNameEn: b.bankNameEn, branch: b.branch, accountName: b.accountName, accountNo: b.accountNo, iban: b.iban, swift: b.swift })),
  };
}

async function customerSnapshot(tx: Tx, customerId: string, address: unknown): Promise<CustomerSnapshot> {
  const c = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
  return {
    number: c.number,
    type: c.type,
    displayName: c.displayName,
    companyName: c.companyName,
    ownerName: c.ownerName,
    dealerNumber: c.dealerNumber,
    phone: c.phone,
    address: (address ?? null) as CustomerSnapshot["address"],
  };
}

const docLanguage = (locale: string | null | undefined): DocLanguage => (locale === "en" ? "EN" : "AR");

/** Rechnung für einen Lieferschein – MUSS in der Lieferschein-Transaktion aufgerufen werden */
export async function issueInvoiceForShipment(tx: Tx, ctx: AuthContext | null, shipmentId: string) {
  const s = await tx.shipment.findUniqueOrThrow({
    where: { id: shipmentId },
    include: { items: { include: { orderItem: true } }, order: { include: { customer: { select: { preferredLocale: true } }, invoices: { select: { id: true, status: true } } } } },
  });
  if (await tx.invoice.findUnique({ where: { shipmentId } })) throw new AppError(409, "already_invoiced");
  const o = s.order;
  const channel = o.channel as PricingChannel;
  const items = [...s.items].sort((a, b) => a.orderItem.sortOrder - b.orderItem.sortOrder);
  const lines: (Omit<Prisma.InvoiceLineCreateManyInvoiceInput, "orderItemId"> & { orderItemId: string | null; lineNet: number; lineVat: number; lineGross: number })[] = items.map((si, idx) => {
    const i = si.orderItem;
    const calc = shippedLine(channel, {
      unitPriceNet: i.unitPriceNet,
      unitPriceGross: i.unitPriceGross,
      vatRateBps: i.vatRateBps,
      unitCode: i.unitCode,
      unitFactor: i.unitFactor,
      orderedQtyBase: i.qtyBase,
      freeQtyBase: i.freeQtyBase,
      shippedQtyBase: si.qtyBase,
    });
    return {
      orderItemId: i.id,
      sku: i.skuSnapshot,
      nameAr: i.nameArSnapshot,
      nameEn: i.nameEnSnapshot,
      unitCode: calc.unitCode,
      unitFactor: calc.unitFactor,
      qty: calc.qty,
      qtyBase: calc.qtyBase,
      unitPriceNet: i.unitPriceNet,
      vatRateBps: i.vatRateBps,
      lineNet: calc.net,
      lineVat: calc.vat,
      lineGross: calc.gross,
      sortOrder: idx,
    };
  });
  // Liefergebühr auf der ersten Rechnung der Bestellung (bzw. der Ursprungsbestellung bei Rückständen nicht erneut)
  const firstInvoice = !o.parentOrderId && !o.invoices.some((i) => i.status !== "CREDITED");
  const fee = firstInvoice ? deliveryFeeLine(o.deliveryFeeGross, o.taxRateBps) : null;
  if (fee) {
    lines.push({
      orderItemId: null,
      sku: "DELIVERY",
      nameAr: "رسوم التوصيل",
      nameEn: "Delivery fee",
      unitCode: "PIECE",
      unitFactor: 1,
      qty: 1,
      qtyBase: 1,
      unitPriceNet: fee.net,
      vatRateBps: o.taxRateBps,
      lineNet: fee.net,
      lineVat: fee.vat,
      lineGross: fee.gross,
      sortOrder: lines.length,
    });
  }
  const totals = documentTotals(lines.map((l) => ({ net: l.lineNet, vat: l.lineVat, gross: l.lineGross })));
  const issueDate = new Date();
  const { number } = await allocateDocumentNumber(tx, "INVOICE", issueDate);
  const prepaid = o.paymentStatus === "PAID";
  const invoice = await tx.invoice.create({
    data: {
      number,
      customerId: o.customerId,
      orderId: o.id,
      shipmentId,
      channel: o.channel,
      issueDate,
      dueDate: dueDateFor(issueDate, o.paymentTermDays),
      status: prepaid ? "PAID" : "ISSUED",
      sellerSnapshot: (await sellerSnapshot(tx)) as unknown as Prisma.InputJsonValue,
      customerSnapshot: (await customerSnapshot(tx, o.customerId, o.addressSnapshot)) as unknown as Prisma.InputJsonValue,
      subtotalNet: totals.net,
      vatTotal: totals.vat,
      totalGross: totals.gross,
      paidAmount: prepaid ? totals.gross : 0,
      paymentMethod: o.paymentMethod,
      language: docLanguage(o.customer.preferredLocale),
      createdById: ctx?.user.id ?? null,
      lines: { create: lines },
    },
  });
  await tx.customerLedgerEntry.create({
    data: { customerId: o.customerId, type: "INVOICE", refId: invoice.id, refNumber: number, date: issueDate, debit: totals.gross, note: o.number },
  });
  if (prepaid) {
    // Vorauszahlung (Karte/Überweisung): Quittung mit Zuordnung zu dieser Rechnung
    const intent = await tx.paymentIntent.findFirst({ where: { orderId: o.id, status: "CAPTURED" }, orderBy: { updatedAt: "desc" } });
    const rc = await allocateDocumentNumber(tx, "RECEIPT", issueDate);
    const payment = await tx.payment.create({
      data: {
        number: rc.number,
        customerId: o.customerId,
        method: o.paymentMethod,
        amount: totals.gross,
        receivedAt: issueDate,
        reference: intent?.providerRef ?? o.number,
        note: `prepaid ${o.number}`,
        receivedById: ctx?.user.id ?? null,
        allocations: { create: { invoiceId: invoice.id, amount: totals.gross } },
      },
    });
    if (intent && !intent.paymentId) await tx.paymentIntent.update({ where: { id: intent.id }, data: { paymentId: payment.id } });
    await tx.customerLedgerEntry.create({
      data: { customerId: o.customerId, type: "PAYMENT", refId: payment.id, refNumber: rc.number, date: issueDate, credit: totals.gross, note: `prepaid ${o.paymentMethod} ${o.number}` },
    });
  }
  await audit(ctx, { action: "invoice.issue", entityType: "Invoice", entityId: invoice.id, after: { number, shipment: s.number, totalGross: totals.gross } }, tx);
  return invoice;
}

export interface CreditInput {
  reason: string;
  /** leer → komplette Rechnung gutschreiben */
  lines?: { invoiceLineId: string; qtyBase: number }[];
  returnId?: string | null;
}

/** Gutschrift zu einer Rechnung (in eigener oder übergebener Transaktion) */
export async function createCreditNote(ctx: AuthContext | null, invoiceId: string, input: CreditInput, outerTx?: Tx) {
  const run = async (tx: Tx) => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { lines: { orderBy: { sortOrder: "asc" } }, creditNotes: { include: { lines: true } } } });
    if (!inv) throw notFound();
    // bereits gutgeschriebene Mengen je Rechnungszeile
    const credited = new Map<string, number>();
    for (const cn of inv.creditNotes) for (const l of cn.lines) if (l.invoiceLineId) credited.set(l.invoiceLineId, (credited.get(l.invoiceLineId) ?? 0) + l.qtyBase);
    const wanted = input.lines?.length
      ? input.lines
      : inv.lines.map((l) => ({ invoiceLineId: l.id, qtyBase: l.qtyBase - (credited.get(l.id) ?? 0) })).filter((l) => l.qtyBase > 0);
    if (wanted.length === 0) throw badRequest("nothing_to_credit");
    const lines = wanted.map((w) => {
      const src = inv.lines.find((l) => l.id === w.invoiceLineId);
      if (!src) throw badRequest("invalid_invoice_line");
      const already = credited.get(src.id) ?? 0;
      if (w.qtyBase + already > src.qtyBase) throw badRequest("credit_exceeds_invoice");
      // Rest der Zeile vollständig → exakte Restwerte (keine Rundungsdifferenzen über mehrere Gutschriften)
      const isRest = w.qtyBase + already === src.qtyBase && already > 0;
      const calc = isRest
        ? (() => {
            const prev = inv.creditNotes.flatMap((c) => c.lines).filter((l) => l.invoiceLineId === src.id);
            const p = documentTotals(prev.map((l) => ({ net: l.lineNet, vat: l.lineVat, gross: l.lineGross })));
            return { net: src.lineNet - p.net, vat: src.lineVat - p.vat, gross: src.lineGross - p.gross };
          })()
        : creditLine({ qtyBase: src.qtyBase, lineNet: src.lineNet, lineVat: src.lineVat, lineGross: src.lineGross }, w.qtyBase);
      return { invoiceLineId: src.id, sku: src.sku, nameAr: src.nameAr, nameEn: src.nameEn, qtyBase: w.qtyBase, unitPriceNet: src.unitPriceNet, vatRateBps: src.vatRateBps, lineNet: calc.net, lineVat: calc.vat, lineGross: calc.gross };
    });
    const totals = documentTotals(lines.map((l) => ({ net: l.lineNet, vat: l.lineVat, gross: l.lineGross })));
    if (inv.creditedAmount + totals.gross > inv.totalGross) throw badRequest("credit_exceeds_invoice");
    const issueDate = new Date();
    const { number } = await allocateDocumentNumber(tx, "CREDIT_NOTE", issueDate);
    const cn = await tx.creditNote.create({
      data: {
        number,
        invoiceId: inv.id,
        customerId: inv.customerId,
        returnId: input.returnId ?? null,
        reason: input.reason,
        issueDate,
        subtotalNet: totals.net,
        vatTotal: totals.vat,
        totalGross: totals.gross,
        customerSnapshot: inv.customerSnapshot as Prisma.InputJsonValue,
        language: inv.language,
        createdById: ctx?.user.id ?? null,
        lines: { create: lines },
      },
    });
    const creditedAmount = inv.creditedAmount + totals.gross;
    // Bereits bezahlter Betrag über dem neuen Rechnungswert bleibt als Guthaben im Kundenkonto (Journal)
    await tx.invoice.update({ where: { id: inv.id }, data: { creditedAmount, status: invoiceStatusFor({ totalGross: inv.totalGross, paidAmount: inv.paidAmount, creditedAmount }) } });
    await tx.customerLedgerEntry.create({ data: { customerId: inv.customerId, type: "CREDIT_NOTE", refId: cn.id, refNumber: number, date: issueDate, credit: totals.gross, note: inv.number } });
    await audit(ctx, { action: "credit_note.issue", entityType: "CreditNote", entityId: cn.id, after: { number, invoice: inv.number, totalGross: totals.gross, reason: input.reason } }, tx);
    return cn;
  };
  return outerTx ? run(outerTx) : prisma.$transaction(run, { timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Archiv (eingefroren)
// ---------------------------------------------------------------------------

/** Rendert und friert Rechnung/Gutschrift ein, falls noch nicht geschehen. Idempotent. */
export async function archiveFiscalDocument(kind: "INVOICE" | "CREDIT_NOTE", id: string, userId: string | null = null): Promise<string | null> {
  const { renderStoredDocument } = await import("./documents");
  const entity =
    kind === "INVOICE"
      ? await prisma.invoice.findUnique({ where: { id }, select: { number: true, archivedDocId: true, language: true } })
      : await prisma.creditNote.findUnique({ where: { id }, select: { number: true, archivedDocId: true, language: true } });
  if (!entity) return null;
  if (entity.archivedDocId) return entity.archivedDocId;
  const lang = entity.language === "EN" ? "en" : entity.language === "BILINGUAL" ? "bi" : "ar";
  const pdf = await renderStoredDocument(kind === "INVOICE" ? "invoice" : "credit-note", id, lang, { original: true });
  const file = await storeFile({ data: pdf, mimeType: "application/pdf", originalName: `${entity.number}.pdf`, purpose: kind === "INVOICE" ? "invoice-pdf" : "credit-note-pdf", uploadedById: userId });
  return prisma.$transaction(async (tx) => {
    // erneut prüfen (parallele Archivierung)
    const current =
      kind === "INVOICE"
        ? await tx.invoice.findUniqueOrThrow({ where: { id }, select: { archivedDocId: true } })
        : await tx.creditNote.findUniqueOrThrow({ where: { id }, select: { archivedDocId: true } });
    if (current.archivedDocId) return current.archivedDocId;
    const doc = await tx.archivedDocument.create({
      data: { docType: kind, number: entity.number, entityType: kind === "INVOICE" ? "Invoice" : "CreditNote", entityId: id, language: entity.language, fileId: file.id, sha256: file.sha256, frozen: true, createdById: userId },
    });
    if (kind === "INVOICE") await tx.invoice.update({ where: { id }, data: { archivedDocId: doc.id } });
    else await tx.creditNote.update({ where: { id }, data: { archivedDocId: doc.id } });
    return doc.id;
  });
}

/** Job: alle noch nicht archivierten Rechnungen/Gutschriften nachholen */
export async function archivePendingDocuments(limit = 20): Promise<number> {
  const [invoices, notes] = await Promise.all([
    prisma.invoice.findMany({ where: { archivedDocId: null }, select: { id: true }, orderBy: { createdAt: "asc" }, take: limit }),
    prisma.creditNote.findMany({ where: { archivedDocId: null }, select: { id: true }, orderBy: { createdAt: "asc" }, take: limit }),
  ]);
  let n = 0;
  for (const i of invoices) if (await archiveFiscalDocument("INVOICE", i.id).catch((e: unknown) => console.error("[archive]", e))) n++;
  for (const c of notes) if (await archiveFiscalDocument("CREDIT_NOTE", c.id).catch((e: unknown) => console.error("[archive]", e))) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Listen
// ---------------------------------------------------------------------------

export const FISCAL_PAGE_SIZE = 50;

export async function listInvoices(f: { q?: string; status?: string; page: number }) {
  const q = f.q?.trim();
  const where: Prisma.InvoiceWhereInput = {
    ...(f.status && ["ISSUED", "PARTIALLY_PAID", "PAID", "CREDITED"].includes(f.status) ? { status: f.status as "ISSUED" } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { customer: { displayName: { contains: q, mode: "insensitive" } } }, { order: { number: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { number: "desc" },
      skip: (f.page - 1) * FISCAL_PAGE_SIZE,
      take: FISCAL_PAGE_SIZE,
      select: { id: true, number: true, issueDate: true, dueDate: true, channel: true, status: true, totalGross: true, paidAmount: true, creditedAmount: true, archivedDocId: true, customer: { select: { id: true, displayName: true } }, order: { select: { id: true, number: true } } },
    }),
    prisma.invoice.count({ where }),
  ]);
  return { items, total, pageSize: FISCAL_PAGE_SIZE };
}

export async function listCreditNotes(f: { q?: string; page: number }) {
  const q = f.q?.trim();
  const where: Prisma.CreditNoteWhereInput = q
    ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { invoice: { number: { contains: q, mode: "insensitive" } } }, { customer: { displayName: { contains: q, mode: "insensitive" } } }] }
    : {};
  const [items, total] = await Promise.all([
    prisma.creditNote.findMany({
      where,
      orderBy: { number: "desc" },
      skip: (f.page - 1) * FISCAL_PAGE_SIZE,
      take: FISCAL_PAGE_SIZE,
      select: { id: true, number: true, issueDate: true, reason: true, totalGross: true, archivedDocId: true, customer: { select: { id: true, displayName: true } }, invoice: { select: { id: true, number: true } } },
    }),
    prisma.creditNote.count({ where }),
  ]);
  return { items, total, pageSize: FISCAL_PAGE_SIZE };
}

export async function getInvoiceDetail(id: string) {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      customer: { select: { id: true, displayName: true, number: true } },
      order: { select: { id: true, number: true } },
      shipment: { select: { id: true, number: true } },
      archivedDoc: { select: { id: true, sha256: true, createdAt: true, language: true } },
      creditNotes: { orderBy: { number: "asc" }, include: { lines: true } },
      allocations: { include: { payment: { select: { id: true, number: true, receivedAt: true, method: true } } } },
    },
  });
  if (!inv) throw notFound();
  const credited = new Map<string, number>();
  for (const cn of inv.creditNotes) for (const l of cn.lines) if (l.invoiceLineId) credited.set(l.invoiceLineId, (credited.get(l.invoiceLineId) ?? 0) + l.qtyBase);
  return { ...inv, lines: inv.lines.map((l) => ({ ...l, creditedQtyBase: credited.get(l.id) ?? 0 })) };
}
