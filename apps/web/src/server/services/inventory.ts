import "server-only";
import { newCostPrice, purchaseStatusFor, stocktakeVariance, type CostUpdateMode } from "@sa/core";
import type { binSchema, goodsReceiptSchema, purchaseOrderSchema, stockAdjustSchema, stocktakeCountSchema, supplierSchema } from "@sa/contracts";
import { allocateDocumentNumber, prisma, type Prisma } from "@sa/db";
import type { z } from "zod";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, notFound } from "../errors";
import { currentTaxRateBps } from "./pricing";
import { defaultWarehouseId, lockStock } from "./stock";

/**
 * Lager & Einkauf (Phase 5). Jede Bestandsänderung: StockLevel-Zeile sperren,
 * StockMovement (nur anhängen) schreiben, Audit – alles in einer Transaktion.
 */

// ---------------------------------------------------------------------------
// Bestand
// ---------------------------------------------------------------------------

export const STOCK_PAGE_SIZE = 50;

export async function listStock(f: { q?: string; low?: boolean; page: number }) {
  const warehouseId = await defaultWarehouseId();
  const q = f.q?.trim();
  const where: Prisma.ProductVariantWhereInput = {
    ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { barcode: q }, { product: { OR: [{ nameAr: { contains: q, mode: "insensitive" } }, { nameEn: { contains: q, mode: "insensitive" } }] } }] } : {}),
  };
  const rows = await prisma.productVariant.findMany({
    where,
    select: {
      id: true,
      sku: true,
      nameAr: true,
      nameEn: true,
      minStock: true,
      costPrice: true,
      active: true,
      defaultBin: { select: { id: true, code: true } },
      product: { select: { nameAr: true, nameEn: true } },
      stockLevels: { where: { warehouseId }, select: { onHand: true, reserved: true } },
    },
    orderBy: { sku: "asc" },
  });
  let items = rows.map((v) => {
    const onHand = v.stockLevels[0]?.onHand ?? 0;
    const reserved = v.stockLevels[0]?.reserved ?? 0;
    return { ...v, onHand, reserved, available: onHand - reserved, value: onHand * v.costPrice, low: onHand - reserved <= v.minStock };
  });
  if (f.low) items = items.filter((i) => i.low && i.active);
  const totalValue = items.reduce((a, i) => a + Math.max(0, i.value), 0);
  return { items: items.slice((f.page - 1) * STOCK_PAGE_SIZE, f.page * STOCK_PAGE_SIZE), total: items.length, pageSize: STOCK_PAGE_SIZE, totalValue };
}

export async function listMovements(f: { sku?: string; type?: string; page: number }) {
  const where: Prisma.StockMovementWhereInput = {
    ...(f.sku ? { variant: { sku: { contains: f.sku.trim(), mode: "insensitive" } } } : {}),
    ...(f.type ? { type: f.type as Prisma.StockMovementWhereInput["type"] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * STOCK_PAGE_SIZE, take: STOCK_PAGE_SIZE, include: { variant: { select: { sku: true } }, bin: { select: { code: true } } } }),
    prisma.stockMovement.count({ where }),
  ]);
  const userIds = [...new Set(items.map((m) => m.createdById).filter((x): x is string => !!x))];
  const users = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return { items: items.map((m) => ({ ...m, by: m.createdById ? (users.get(m.createdById) ?? "") : "" })), total, pageSize: STOCK_PAGE_SIZE };
}

/** Bestandskorrektur (Bruch, Schwund, Fund) – nie unter die Reservierung */
export async function adjustStock(ctx: AuthContext, input: z.infer<typeof stockAdjustSchema>) {
  return prisma.$transaction(async (tx) => {
    const v = await tx.productVariant.findUnique({ where: { sku: input.sku }, select: { id: true, costPrice: true, defaultBinId: true } });
    if (!v) throw notFound("unknown_sku");
    const warehouseId = await defaultWarehouseId(tx);
    const level = (await lockStock(tx, warehouseId, [v.id])).get(v.id)!;
    if (level.onHand + input.qtyBase < level.reserved) throw new AppError(409, "below_reserved", "below_reserved", { onHand: level.onHand, reserved: level.reserved });
    await tx.stockLevel.update({ where: { variantId_warehouseId: { variantId: v.id, warehouseId } }, data: { onHand: { increment: input.qtyBase } } });
    const m = await tx.stockMovement.create({ data: { variantId: v.id, warehouseId, binId: v.defaultBinId, type: "ADJUSTMENT", qtyBase: input.qtyBase, unitCost: v.costPrice, refType: "Adjustment", note: input.reason, createdById: ctx.user.id } });
    await audit(ctx, { action: "stock.adjust", entityType: "ProductVariant", entityId: v.id, before: { onHand: level.onHand }, after: { onHand: level.onHand + input.qtyBase, reason: input.reason } }, tx);
    return m;
  });
}

// --- Lagerplätze --------------------------------------------------------------

export async function listBins() {
  const warehouseId = await defaultWarehouseId();
  return prisma.bin.findMany({ where: { warehouseId }, orderBy: [{ sortKey: "asc" }, { code: "asc" }], include: { _count: { select: { defaultFor: true } } } });
}

export async function saveBin(ctx: AuthContext, id: string | null, input: z.infer<typeof binSchema>) {
  const warehouseId = await defaultWarehouseId();
  const clash = await prisma.bin.findUnique({ where: { warehouseId_code: { warehouseId, code: input.code } } });
  if (clash && clash.id !== id) throw new AppError(409, "duplicate");
  const row = id ? await prisma.bin.update({ where: { id }, data: input }) : await prisma.bin.create({ data: { ...input, warehouseId } });
  await audit(ctx, { action: id ? "bin.update" : "bin.create", entityType: "Bin", entityId: row.id, after: row });
  return row;
}

export async function deleteBin(ctx: AuthContext, id: string) {
  const b = await prisma.bin.findUnique({ where: { id }, include: { _count: { select: { defaultFor: true, stockMovements: true } } } });
  if (!b) throw notFound();
  if (b._count.defaultFor || b._count.stockMovements) throw new AppError(409, "bin_in_use");
  await prisma.bin.delete({ where: { id } });
  await audit(ctx, { action: "bin.delete", entityType: "Bin", entityId: id, before: b });
}

export async function setVariantBin(ctx: AuthContext, sku: string, binId: string | null) {
  const v = await prisma.productVariant.findUnique({ where: { sku } });
  if (!v) throw notFound("unknown_sku");
  await prisma.productVariant.update({ where: { id: v.id }, data: { defaultBinId: binId } });
  await audit(ctx, { action: "variant.bin", entityType: "ProductVariant", entityId: v.id, before: { binId: v.defaultBinId }, after: { binId } });
}

// --- Inventur -----------------------------------------------------------------

export function listStocktakes() {
  return prisma.stocktake.findMany({ orderBy: { startedAt: "desc" }, take: 50, include: { _count: { select: { lines: true } }, warehouse: { select: { name: true } } } });
}

/** Inventur anlegen: Soll-Mengen werden eingefroren (Zählliste) */
export async function createStocktake(ctx: AuthContext, input: { note?: string; binPrefix?: string }) {
  const warehouseId = await defaultWarehouseId();
  if (await prisma.stocktake.findFirst({ where: { warehouseId, status: { in: ["OPEN", "COUNTING"] } } })) throw new AppError(409, "stocktake_open");
  const variants = await prisma.productVariant.findMany({
    where: { active: true, ...(input.binPrefix ? { defaultBin: { code: { startsWith: input.binPrefix } } } : {}) },
    select: { id: true, defaultBinId: true, stockLevels: { where: { warehouseId }, select: { onHand: true } } },
  });
  return prisma.$transaction(async (tx) => {
    const { number } = await allocateDocumentNumber(tx, "STOCKTAKE");
    const st = await tx.stocktake.create({
      data: {
        number,
        warehouseId,
        note: input.note,
        createdById: ctx.user.id,
        lines: { create: variants.map((v) => ({ variantId: v.id, binId: v.defaultBinId, expectedQty: v.stockLevels[0]?.onHand ?? 0 })) },
      },
    });
    await audit(ctx, { action: "stocktake.create", entityType: "Stocktake", entityId: st.id, after: { number, lines: variants.length } }, tx);
    return st;
  });
}

export async function getStocktake(id: string) {
  const st = await prisma.stocktake.findUnique({
    where: { id },
    include: { lines: { include: { bin: { select: { code: true, sortKey: true } }, variant: { select: { sku: true, nameAr: true, nameEn: true, product: { select: { nameAr: true, nameEn: true } } } } } } },
  });
  if (!st) throw notFound();
  st.lines.sort((a, b) => (a.bin?.sortKey ?? 1e9) - (b.bin?.sortKey ?? 1e9) || a.variant.sku.localeCompare(b.variant.sku));
  return { ...st, variance: stocktakeVariance(st.lines.map((l) => ({ expected: l.expectedQty, counted: l.countedQty }))) };
}

export async function saveStocktakeCounts(ctx: AuthContext, id: string, input: z.infer<typeof stocktakeCountSchema>) {
  const st = await prisma.stocktake.findUnique({ where: { id } });
  if (!st) throw notFound();
  if (st.status !== "OPEN" && st.status !== "COUNTING") throw new AppError(409, "invalid_status");
  await prisma.$transaction(async (tx) => {
    for (const l of input.lines) {
      await tx.stocktakeLine.updateMany({ where: { id: l.lineId, stocktakeId: id }, data: { countedQty: l.countedQty, countedById: l.countedQty == null ? null : ctx.user.id, countedAt: l.countedQty == null ? null : new Date() } });
    }
    if (st.status === "OPEN") await tx.stocktake.update({ where: { id }, data: { status: "COUNTING" } });
  });
}

/**
 * Inventur abschließen: Differenz je gezählter Position als STOCKTAKE-Bewegung buchen.
 * Bewegungen seit Inventurbeginn werden berücksichtigt (Ist = gezählt + Bewegungen danach).
 */
export async function closeStocktake(ctx: AuthContext, id: string) {
  return prisma.$transaction(
    async (tx) => {
      const st = await tx.stocktake.findUnique({ where: { id }, include: { lines: true } });
      if (!st) throw notFound();
      if (st.status !== "OPEN" && st.status !== "COUNTING") throw new AppError(409, "invalid_status");
      const counted = st.lines.filter((l) => l.countedQty != null);
      const levels = await lockStock(tx, st.warehouseId, counted.map((l) => l.variantId));
      let adjusted = 0;
      for (const l of counted) {
        const diff = l.countedQty! - l.expectedQty;
        if (diff === 0) continue;
        const level = levels.get(l.variantId)!;
        const v = await tx.productVariant.findUniqueOrThrow({ where: { id: l.variantId }, select: { costPrice: true } });
        await tx.stockLevel.update({ where: { variantId_warehouseId: { variantId: l.variantId, warehouseId: st.warehouseId } }, data: { onHand: Math.max(level.reserved, level.onHand + diff) } });
        await tx.stockMovement.create({ data: { variantId: l.variantId, warehouseId: st.warehouseId, binId: l.binId, type: "STOCKTAKE", qtyBase: diff, unitCost: v.costPrice, refType: "Stocktake", refId: st.id, note: st.number, createdById: ctx.user.id } });
        adjusted++;
      }
      await tx.stocktake.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
      await audit(ctx, { action: "stocktake.close", entityType: "Stocktake", entityId: id, after: { number: st.number, adjusted, counted: counted.length } }, tx);
      return { adjusted };
    },
    { timeout: 60_000 },
  );
}

export async function cancelStocktake(ctx: AuthContext, id: string) {
  const st = await prisma.stocktake.findUnique({ where: { id } });
  if (!st) throw notFound();
  if (st.status === "CLOSED") throw new AppError(409, "invalid_status");
  await prisma.stocktake.update({ where: { id }, data: { status: "CANCELLED", closedAt: new Date() } });
  await audit(ctx, { action: "stocktake.cancel", entityType: "Stocktake", entityId: id });
}

// ---------------------------------------------------------------------------
// Einkauf
// ---------------------------------------------------------------------------

export function listSuppliers() {
  return prisma.supplier.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { purchaseOrders: true } } } });
}

export async function saveSupplier(ctx: AuthContext, id: string | null, input: z.infer<typeof supplierSchema>) {
  const data = { ...input, contactName: input.contactName ?? null, phone: input.phone ?? null, email: input.email ?? null, dealerNumber: input.dealerNumber ?? null, address: input.address ?? null, paymentTermDays: input.paymentTermDays ?? null };
  const row = id
    ? await prisma.supplier.update({ where: { id }, data })
    : await prisma.$transaction(async (tx) => tx.supplier.create({ data: { ...data, number: `S-${String((await tx.supplier.count()) + 1).padStart(4, "0")}` } }));
  await audit(ctx, { action: id ? "supplier.update" : "supplier.create", entityType: "Supplier", entityId: row.id, after: row });
  return row;
}

export const PO_PAGE_SIZE = 30;

export async function listPurchaseOrders(f: { status?: string; page: number }) {
  const where: Prisma.PurchaseOrderWhereInput = f.status ? { status: f.status as Prisma.PurchaseOrderWhereInput["status"] } : {};
  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * PO_PAGE_SIZE, take: PO_PAGE_SIZE, include: { supplier: { select: { name: true } }, _count: { select: { items: true } } } }),
    prisma.purchaseOrder.count({ where }),
  ]);
  return { items, total, pageSize: PO_PAGE_SIZE };
}

export async function getPurchaseOrder(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { variant: { select: { sku: true, nameAr: true, nameEn: true, defaultBinId: true, product: { select: { nameAr: true, nameEn: true } } } } } },
      receipts: { orderBy: { receivedAt: "desc" }, include: { items: true } },
    },
  });
  if (!po) throw notFound();
  return po;
}

async function poLines(input: z.infer<typeof purchaseOrderSchema>) {
  const variants = await prisma.productVariant.findMany({ where: { sku: { in: input.items.map((i) => i.sku) } }, select: { id: true, sku: true, units: { select: { factor: true, unit: { select: { code: true } } } } } });
  return input.items.map((i) => {
    const v = variants.find((x) => x.sku === i.sku);
    if (!v) throw badRequest("unknown_sku", { sku: i.sku });
    const u = v.units.find((x) => x.unit.code === i.unitCode);
    if (!u) throw badRequest("invalid_unit", { sku: i.sku });
    // Einkaufspreis wird je Basiseinheit gespeichert (auf Agorot gerundet)
    return { variantId: v.id, unitCode: i.unitCode, unitFactor: u.factor, qty: i.qty, unitCostNet: Math.round(i.unitCost / u.factor) };
  });
}

async function poTotals(lines: { unitCostNet: number; unitFactor: number; qty: number }[]) {
  const net = lines.reduce((a, l) => a + l.unitCostNet * l.unitFactor * l.qty, 0);
  const rate = await currentTaxRateBps(new Date());
  const vat = Math.round((net * rate) / 10_000);
  return { subtotalNet: net, vatTotal: vat, totalGross: net + vat };
}

export async function createPurchaseOrder(ctx: AuthContext, input: z.infer<typeof purchaseOrderSchema>) {
  const lines = await poLines(input);
  const totals = await poTotals(lines);
  return prisma.$transaction(async (tx) => {
    const { number } = await allocateDocumentNumber(tx, "PURCHASE_ORDER");
    const po = await tx.purchaseOrder.create({ data: { number, supplierId: input.supplierId, expectedAt: input.expectedAt, note: input.note, createdById: ctx.user.id, ...totals, items: { create: lines } } });
    await audit(ctx, { action: "po.create", entityType: "PurchaseOrder", entityId: po.id, after: { number, ...totals } }, tx);
    return po;
  });
}

export async function updatePurchaseOrder(ctx: AuthContext, id: string, input: z.infer<typeof purchaseOrderSchema>) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw notFound();
  if (po.status !== "DRAFT") throw new AppError(409, "invalid_status");
  const lines = await poLines(input);
  const totals = await poTotals(lines);
  await prisma.$transaction([
    prisma.purchaseOrderItem.deleteMany({ where: { poId: id } }),
    prisma.purchaseOrder.update({ where: { id }, data: { supplierId: input.supplierId, expectedAt: input.expectedAt, note: input.note ?? null, ...totals, items: { create: lines } } }),
  ]);
  await audit(ctx, { action: "po.update", entityType: "PurchaseOrder", entityId: id, after: totals });
}

export async function setPurchaseOrderStatus(ctx: AuthContext, id: string, to: "ORDERED" | "CANCELLED") {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw notFound();
  if (to === "ORDERED" && po.status !== "DRAFT") throw new AppError(409, "invalid_status");
  if (to === "CANCELLED" && !["DRAFT", "ORDERED"].includes(po.status)) throw new AppError(409, "invalid_status");
  await prisma.purchaseOrder.update({ where: { id }, data: { status: to, ...(to === "ORDERED" ? { orderedAt: new Date() } : {}) } });
  await audit(ctx, { action: `po.${to.toLowerCase()}`, entityType: "PurchaseOrder", entityId: id, before: { status: po.status }, after: { status: to } });
}

/**
 * Wareneingang: Bestand erhöhen, RECEIPT-Bewegung, Einstandspreis aktualisieren
 * (letzter Preis oder gleitender Durchschnitt) inkl. Preis-Historie.
 */
export async function receiveGoods(ctx: AuthContext, poId: string, input: z.infer<typeof goodsReceiptSchema>) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${poId} FOR UPDATE`;
      const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
      if (!po) throw notFound();
      if (po.status !== "ORDERED" && po.status !== "PARTIALLY_RECEIVED") throw new AppError(409, "invalid_status");
      const lines = input.items.filter((i) => i.qtyBase > 0);
      if (!lines.length) throw badRequest("nothing_to_receive");
      const warehouseId = await defaultWarehouseId(tx);
      const items = lines.map((l) => {
        const pi = po.items.find((x) => x.id === l.poItemId);
        if (!pi) throw badRequest("invalid_item");
        return { l, pi };
      });
      const levels = await lockStock(tx, warehouseId, items.map((x) => x.pi.variantId));
      const { number } = await allocateDocumentNumber(tx, "GOODS_RECEIPT");
      const receipt = await tx.goodsReceipt.create({ data: { number, supplierId: po.supplierId, poId, costUpdateMode: input.costUpdateMode, createdById: ctx.user.id } });
      for (const { l, pi } of items) {
        const cost = l.unitCostNet ?? pi.unitCostNet;
        const v = await tx.productVariant.findUniqueOrThrow({ where: { id: pi.variantId }, select: { costPrice: true, defaultBinId: true } });
        const level = levels.get(pi.variantId)!;
        const binId = l.binId ?? v.defaultBinId;
        await tx.goodsReceiptItem.create({ data: { receiptId: receipt.id, poItemId: pi.id, variantId: pi.variantId, binId, qtyBase: l.qtyBase, unitCostNet: cost } });
        await tx.stockLevel.update({ where: { variantId_warehouseId: { variantId: pi.variantId, warehouseId } }, data: { onHand: { increment: l.qtyBase } } });
        await tx.stockMovement.create({ data: { variantId: pi.variantId, warehouseId, binId, type: "RECEIPT", qtyBase: l.qtyBase, unitCost: cost, refType: "GoodsReceipt", refId: receipt.id, note: po.number, createdById: ctx.user.id } });
        const newCost = newCostPrice(input.costUpdateMode as CostUpdateMode, level.onHand, v.costPrice, l.qtyBase, cost);
        level.onHand += l.qtyBase;
        if (newCost !== v.costPrice) {
          await tx.productVariant.update({ where: { id: pi.variantId }, data: { costPrice: newCost } });
          await tx.priceHistory.create({ data: { variantId: pi.variantId, field: "COST", oldPrice: v.costPrice, newPrice: newCost, source: "GOODS_RECEIPT", changedById: ctx.user.id } });
        }
        await tx.purchaseOrderItem.update({ where: { id: pi.id }, data: { receivedQtyBase: { increment: l.qtyBase } } });
        pi.receivedQtyBase += l.qtyBase;
      }
      const status = purchaseStatusFor(po.items.map((i) => ({ orderedBase: i.qty * i.unitFactor, receivedBase: i.receivedQtyBase })));
      await tx.purchaseOrder.update({ where: { id: poId }, data: { status } });
      await audit(ctx, { action: "goods.receive", entityType: "GoodsReceipt", entityId: receipt.id, after: { number, po: po.number, lines: items.length, status } }, tx);
      return { id: receipt.id, number, status };
    },
    { timeout: 30_000 },
  );
}

