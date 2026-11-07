/**
 * Testbestellungen vollständig löschen (vor dem echten Start).
 * Aufruf über scripts/delete-orders.sh:
 *   ORDERS_MODE=list                      → alle Bestellungen auflisten
 *   ORDERS_MODE=delete ORDERS=ALL|SO-…,…  → löschen (inkl. Rechnungen, Zahlungen, Lieferscheine, Abrechnungen),
 *                                           Bestand zurückbuchen, Angebots-Nutzung freigeben
 *   RESET_NUMBERS=yes                     → wenn danach keine Bestellung mehr existiert: Nummern ab 1
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
type Tx = Prisma.TransactionClient;
const money = (a: number) => `${(a / 100).toFixed(2)} ₪`;

async function list() {
  const orders = await prisma.order.findMany({
    orderBy: { placedAt: "asc" },
    select: { number: true, status: true, totalGross: true, placedAt: true, customer: { select: { displayName: true } } },
  });
  if (!orders.length) {
    console.log("Keine Bestellungen vorhanden.");
    return;
  }
  for (const o of orders) {
    console.log(`${o.number.padEnd(16)} ${o.placedAt.toISOString().slice(0, 10)}  ${money(o.totalGross).padStart(12)}  ${o.status.padEnd(16)} ${o.customer.displayName}`);
  }
  console.log(`\nInsgesamt ${orders.length} Bestellungen.`);
}

/** Bestellungen samt Rückständen (Kind-Bestellungen) */
async function collectOrderIds(tx: Tx, numbers: string[] | "ALL") {
  const roots = await tx.order.findMany({ where: numbers === "ALL" ? {} : { number: { in: numbers } }, select: { id: true, number: true } });
  if (numbers !== "ALL") {
    const missing = numbers.filter((n) => !roots.some((r) => r.number === n));
    if (missing.length) throw new Error(`Nicht gefunden: ${missing.join(", ")}`);
  }
  const ids = new Set(roots.map((r) => r.id));
  let frontier = [...ids];
  while (frontier.length) {
    const kids = await tx.order.findMany({ where: { parentOrderId: { in: frontier } }, select: { id: true } });
    frontier = kids.map((k) => k.id).filter((id) => !ids.has(id));
    frontier.forEach((id) => ids.add(id));
  }
  return [...ids];
}

async function remove(tx: Tx, orderIds: string[]) {
  const items = await tx.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
  const itemIds = items.map((i) => i.id);
  const shipments = await tx.shipment.findMany({ where: { orderId: { in: orderIds } }, select: { id: true, codAmount: true, courierSettlementId: true } });
  const shipmentIds = shipments.map((s) => s.id);
  const invoices = await tx.invoice.findMany({ where: { OR: [{ orderId: { in: orderIds } }, { shipmentId: { in: shipmentIds } }] }, select: { id: true, archivedDocId: true } });
  const invoiceIds = invoices.map((i) => i.id);
  const returns = await tx.return.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
  const returnIds = returns.map((r) => r.id);
  const creditNotes = await tx.creditNote.findMany({ where: { OR: [{ invoiceId: { in: invoiceIds } }, { returnId: { in: returnIds } }] }, select: { id: true, archivedDocId: true } });
  const creditNoteIds = creditNotes.map((c) => c.id);

  // 1) Bestand zurück: Lagerbewegungen dieser Lieferscheine/Rückgaben umkehren, offene Reservierungen freigeben
  const movements = await tx.stockMovement.findMany({
    where: { OR: [{ refType: "Shipment", refId: { in: shipmentIds } }, { refType: "Return", refId: { in: returnIds } }] },
    select: { id: true, variantId: true, warehouseId: true, qtyBase: true, type: true },
  });
  for (const m of movements) {
    // Verkauf (SALE) ist negativ gebucht, Rückgaben (RETURN) positiv → Gegenbuchung = −qty
    const delta = m.type === "SALE" && m.qtyBase > 0 ? m.qtyBase : -m.qtyBase;
    await tx.stockLevel.update({ where: { variantId_warehouseId: { variantId: m.variantId, warehouseId: m.warehouseId } }, data: { onHand: { increment: delta } } });
  }
  await tx.stockMovement.deleteMany({ where: { id: { in: movements.map((m) => m.id) } } });
  const reservations = await tx.stockReservation.findMany({ where: { orderItemId: { in: itemIds }, status: "ACTIVE" }, select: { variantId: true, qtyBase: true } });
  const warehouse = (await tx.warehouse.findFirst({ where: { isDefault: true } })) ?? (await tx.warehouse.findFirst());
  for (const r of reservations) {
    if (warehouse) await tx.stockLevel.updateMany({ where: { variantId: r.variantId, warehouseId: warehouse.id }, data: { reserved: { decrement: r.qtyBase } } });
  }

  // 2) Zahlungen: nur die, die ausschließlich auf diese Rechnungen gebucht sind
  const allocs = await tx.paymentAllocation.findMany({ where: { invoiceId: { in: invoiceIds } }, select: { paymentId: true } });
  const candidatePayments = [...new Set(allocs.map((a) => a.paymentId))];
  const paymentIds: string[] = [];
  for (const pid of candidatePayments) {
    const other = await tx.paymentAllocation.count({ where: { paymentId: pid, invoiceId: { notIn: invoiceIds } } });
    if (other === 0) paymentIds.push(pid);
  }
  await tx.paymentAllocation.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await tx.paymentIntent.updateMany({ where: { paymentId: { in: paymentIds } }, data: { paymentId: null } });
  await tx.paymentIntent.deleteMany({ where: { orderId: { in: orderIds } } });

  // 3) Fahrer/Touren (falls genutzt) und Zustellfirmen-Abrechnungen
  const stops = await tx.tourStop.findMany({ where: { shipmentId: { in: shipmentIds } }, select: { id: true } });
  await tx.cashCollection.deleteMany({ where: { OR: [{ tourStopId: { in: stops.map((s) => s.id) } }, { paymentId: { in: paymentIds } }] } });
  await tx.tourStop.deleteMany({ where: { id: { in: stops.map((s) => s.id) } } });

  // 4) Kundenkonto-Buchungen (Rechnung, Gutschrift, Zahlung)
  await tx.customerLedgerEntry.deleteMany({ where: { refId: { in: [...invoiceIds, ...creditNoteIds, ...paymentIds] } } });
  await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });

  // 5) Mahnungen, Gutschriften, Rückgaben, Rechnungen, Archiv-PDFs
  await tx.dunningNoticeInvoice.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await tx.creditNoteLine.deleteMany({ where: { creditNoteId: { in: creditNoteIds } } });
  await tx.creditNote.deleteMany({ where: { id: { in: creditNoteIds } } });
  await tx.return.deleteMany({ where: { id: { in: returnIds } } });
  await tx.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  const archived = [...invoices, ...creditNotes].map((x) => x.archivedDocId).filter((x): x is string => !!x);
  await tx.archivedDocument.deleteMany({ where: { OR: [{ id: { in: archived } }, { entityId: { in: [...orderIds, ...invoiceIds, ...creditNoteIds, ...shipmentIds] } }] } });

  // 6) Lieferscheine; Abrechnungen mit der Zustellfirma anpassen
  const settlementIds = [...new Set(shipments.map((s) => s.courierSettlementId).filter((x): x is string => !!x))];
  await tx.shipment.deleteMany({ where: { id: { in: shipmentIds } } });
  for (const sid of settlementIds) {
    const left = await tx.shipment.aggregate({ where: { courierSettlementId: sid }, _sum: { codAmount: true }, _count: { _all: true } });
    if (left._count._all === 0) await tx.courierSettlement.delete({ where: { id: sid } });
    else await tx.courierSettlement.update({ where: { id: sid }, data: { amount: left._sum.codAmount ?? 0 } });
  }

  // 7) Angebots-/Gutschein-Nutzung freigeben
  const redemptions = await tx.orderOfferRedemption.findMany({ where: { orderId: { in: orderIds } }, select: { offerId: true } });
  for (const r of redemptions) await tx.orderOffer.updateMany({ where: { id: r.offerId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });

  // 8) Bestellungen (Kinder zuerst; Positionen, Reservierungen, Verlauf werden mitgelöscht)
  await tx.order.updateMany({ where: { id: { in: orderIds } }, data: { parentOrderId: null } });
  await tx.order.deleteMany({ where: { id: { in: orderIds } } });

  return { orders: orderIds.length, invoices: invoiceIds.length, payments: paymentIds.length, shipments: shipmentIds.length, movements: movements.length };
}

/** „Alle“: auch übrige Test-Zahlungen (ohne Rechnung, z. B. Guthaben) und Mahnungen entfernen */
async function removeLooseFinance(tx: Tx) {
  const payments = await tx.payment.findMany({ select: { id: true } });
  const ids = payments.map((p) => p.id);
  await tx.cashCollection.deleteMany({ where: { paymentId: { in: ids } } });
  await tx.paymentIntent.updateMany({ where: { paymentId: { in: ids } }, data: { paymentId: null } });
  await tx.paymentAllocation.deleteMany({ where: { paymentId: { in: ids } } });
  await tx.payment.deleteMany({ where: { id: { in: ids } } });
  await tx.dunningNoticeInvoice.deleteMany({});
  await tx.dunningNotice.deleteMany({});
  // Kundenkonto: Belegbuchungen weg; Eröffnungssalden und manuelle Korrekturen bleiben
  await tx.customerLedgerEntry.deleteMany({ where: { type: { in: ["INVOICE", "CREDIT_NOTE", "PAYMENT", "REFUND", "DUNNING_FEE"] } } });
  return ids.length;
}

/** Nummernkreise des laufenden Jahres auf 1 – je Belegart nur, wenn davon nichts mehr existiert */
async function resetNumbers(tx: Tx) {
  const year = new Date().getFullYear();
  const empty: Record<string, () => Promise<number>> = {
    ORDER: () => tx.order.count(),
    INVOICE: () => tx.invoice.count(),
    DELIVERY_NOTE: () => tx.shipment.count(),
    RECEIPT: () => tx.payment.count(),
    CREDIT_NOTE: () => tx.creditNote.count(),
    RETURN: () => tx.return.count(),
    DUNNING: () => tx.dunningNotice.count(),
  };
  const done: string[] = [];
  for (const [docType, count] of Object.entries(empty)) {
    if ((await count()) > 0) continue;
    await tx.numberSequence.updateMany({ where: { year, docType: docType as Prisma.NumberSequenceWhereInput["docType"] & string }, data: { nextNumber: 1 } });
    done.push(docType);
  }
  return done;
}

async function main() {
  const mode = process.env.ORDERS_MODE ?? "list";
  if (mode === "list") return list();
  const raw = (process.env.ORDERS ?? "").trim();
  if (!raw) throw new Error("Keine Bestellungen angegeben.");
  const numbers = raw.toUpperCase() === "ALL" ? ("ALL" as const) : raw.split(/[\s,]+/).filter(Boolean).map((n) => n.toUpperCase());
  const result = await prisma.$transaction(
    async (tx) => {
      // Wartungsmodus nur für diese Transaktion: Rechnungen/Buchungen sind sonst gegen Löschen geschützt
      await tx.$executeRawUnsafe("SET LOCAL sa.allow_purge = 'on'");
      const ids = await collectOrderIds(tx, numbers);
      if (!ids.length) throw new Error("Keine Bestellungen gefunden.");
      const r = await remove(tx, ids);
      const loose = numbers === "ALL" ? await removeLooseFinance(tx) : 0;
      const reset = process.env.RESET_NUMBERS === "yes" ? await resetNumbers(tx) : [];
      return { ...r, payments: r.payments + loose, reset };
    },
    { timeout: 120_000 },
  );
  console.log(`Gelöscht: ${result.orders} Bestellungen, ${result.invoices} Rechnungen, ${result.payments} Zahlungen, ${result.shipments} Lieferscheine; ${result.movements} Lagerbewegungen zurückgebucht.`);
  if (process.env.RESET_NUMBERS === "yes") {
    console.log(result.reset.length ? `Nummern ab 1: ${result.reset.join(", ")}` : "Nummern NICHT zurückgesetzt (es gibt noch Belege).");
  }
}

main()
  .catch((err) => {
    console.error("Fehler:", (err as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
