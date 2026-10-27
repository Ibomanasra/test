import "server-only";
import { prisma, type Tx } from "@sa/db";
import { AppError } from "../errors";

/**
 * Bestand: StockMovement ist das Journal, StockLevel die materialisierte Summe
 * (onHand / reserved). Alle Änderungen laufen in der aufrufenden Transaktion
 * und sperren die betroffenen StockLevel-Zeilen (SELECT … FOR UPDATE) → keine Überverkäufe.
 */

export async function defaultWarehouseId(tx: Tx | typeof prisma = prisma): Promise<string> {
  const w = await tx.warehouse.findFirst({ where: { isDefault: true }, select: { id: true } });
  if (!w) throw new AppError(500, "no_default_warehouse");
  return w.id;
}

/** Sperrt und liefert die Bestandszeilen (legt fehlende mit 0 an). */
export async function lockStock(tx: Tx, warehouseId: string, variantIds: string[]) {
  const ids = [...new Set(variantIds)].sort();
  for (const id of ids) {
    await tx.$executeRaw`
      INSERT INTO "StockLevel" ("variantId", "warehouseId", "onHand", "reserved", "updatedAt")
      VALUES (${id}, ${warehouseId}, 0, 0, now()) ON CONFLICT DO NOTHING`;
  }
  const rows = await tx.$queryRaw<{ variantId: string; onHand: number; reserved: number }[]>`
    SELECT "variantId", "onHand", "reserved" FROM "StockLevel"
    WHERE "warehouseId" = ${warehouseId} AND "variantId" = ANY(${ids})
    ORDER BY "variantId" FOR UPDATE`;
  return new Map(rows.map((r) => [r.variantId, r]));
}

export interface ReserveItem {
  orderItemId: string;
  variantId: string;
  qtyBase: number;
  sku: string;
}

/** Reserviert Bestand für Bestellpositionen; wirft 409 insufficient_stock mit Details. */
export async function reserveStock(tx: Tx, items: ReserveItem[]) {
  if (items.length === 0) return;
  const warehouseId = await defaultWarehouseId(tx);
  const levels = await lockStock(tx, warehouseId, items.map((i) => i.variantId));
  const need = new Map<string, number>();
  for (const i of items) need.set(i.variantId, (need.get(i.variantId) ?? 0) + i.qtyBase);
  const short = [...need.entries()]
    .map(([variantId, qty]) => {
      const l = levels.get(variantId)!;
      return { variantId, sku: items.find((i) => i.variantId === variantId)!.sku, requested: qty, available: l.onHand - l.reserved };
    })
    .filter((s) => s.requested > s.available);
  if (short.length) throw new AppError(409, "insufficient_stock", "insufficient_stock", { items: short });
  for (const [variantId, qty] of need) {
    await tx.stockLevel.update({ where: { variantId_warehouseId: { variantId, warehouseId } }, data: { reserved: { increment: qty } } });
  }
  await tx.stockReservation.createMany({ data: items.map((i) => ({ orderItemId: i.orderItemId, variantId: i.variantId, qtyBase: i.qtyBase })) });
}

/** Gibt aktive Reservierungen (ganz oder teilweise) frei. */
export async function releaseReservations(tx: Tx, orderItemIds: string[], qtyByItem?: Map<string, number>) {
  const res = await tx.stockReservation.findMany({ where: { orderItemId: { in: orderItemIds }, status: "ACTIVE" } });
  if (res.length === 0) return;
  const warehouseId = await defaultWarehouseId(tx);
  await lockStock(tx, warehouseId, res.map((r) => r.variantId));
  for (const r of res) {
    const qty = Math.min(r.qtyBase, qtyByItem?.get(r.orderItemId) ?? r.qtyBase);
    if (qty <= 0) continue;
    await tx.stockLevel.update({ where: { variantId_warehouseId: { variantId: r.variantId, warehouseId } }, data: { reserved: { decrement: qty } } });
    if (qty === r.qtyBase) await tx.stockReservation.update({ where: { id: r.id }, data: { status: "RELEASED" } });
    else await tx.stockReservation.update({ where: { id: r.id }, data: { qtyBase: r.qtyBase - qty } });
  }
}

/**
 * Warenausgang (Lieferschein): verbraucht Reservierungen und bucht SALE-Bewegungen.
 * Liefert Menge ≤ reserviert; Rest bleibt reserviert (Rückstand).
 */
export async function consumeForShipment(
  tx: Tx,
  shipmentId: string,
  lines: { orderItemId: string; variantId: string; qtyBase: number; unitCost: number }[],
  userId: string | null,
) {
  const warehouseId = await defaultWarehouseId(tx);
  const levels = await lockStock(tx, warehouseId, lines.map((l) => l.variantId));
  for (const l of lines) {
    if (l.qtyBase <= 0) continue;
    const level = levels.get(l.variantId)!;
    if (level.onHand < l.qtyBase) throw new AppError(409, "insufficient_stock", "insufficient_stock", { items: [{ variantId: l.variantId, requested: l.qtyBase, available: level.onHand }] });
    const res = await tx.stockReservation.findFirst({ where: { orderItemId: l.orderItemId, status: "ACTIVE" } });
    const fromReservation = Math.min(res?.qtyBase ?? 0, l.qtyBase);
    await tx.stockLevel.update({
      where: { variantId_warehouseId: { variantId: l.variantId, warehouseId } },
      data: { onHand: { decrement: l.qtyBase }, reserved: { decrement: fromReservation } },
    });
    level.onHand -= l.qtyBase;
    if (res) {
      if (fromReservation === res.qtyBase) await tx.stockReservation.update({ where: { id: res.id }, data: { status: "CONSUMED" } });
      else await tx.stockReservation.update({ where: { id: res.id }, data: { qtyBase: res.qtyBase - fromReservation } });
    }
    const variant = await tx.productVariant.findUnique({ where: { id: l.variantId }, select: { defaultBinId: true } });
    await tx.stockMovement.create({
      data: { variantId: l.variantId, warehouseId, binId: variant?.defaultBinId, type: "SALE", qtyBase: -l.qtyBase, unitCost: l.unitCost, refType: "Shipment", refId: shipmentId, createdById: userId },
    });
  }
}

export async function availableStock(variantIds: string[]) {
  const levels = await prisma.stockLevel.groupBy({ by: ["variantId"], where: { variantId: { in: variantIds } }, _sum: { onHand: true, reserved: true } });
  return new Map(levels.map((l) => [l.variantId, (l._sum.onHand ?? 0) - (l._sum.reserved ?? 0)]));
}
