import "server-only";
import type { z } from "zod";
import type {
  bulkAdjustSchema,
  categoryDiscountSchema,
  customerPriceSchema,
  groupSchema,
  priceListItemSchema,
  priceListSchema,
  promotionSchema,
  roundingRuleSchema,
  scheduledPriceSchema,
  tierPriceSchema,
  VariantPriceUpdate,
} from "@sa/contracts";
import {
  bulkAdjust,
  formatMoney,
  grossToNet,
  hasPermission,
  marginBpsOf,
  minimumPriceNet,
  parseShekel,
  resolvePrice,
  type PriceResult,
  type RoundingModeKey,
} from "@sa/core";
import { prisma, type PriceChangeSource, type PriceField, type Prisma, type Tx } from "@sa/db";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, conflict, forbidden, notFound } from "../errors";
import { currentTaxRateBps, getMinMarginBps, loadPricingCustomer, loadPricingProducts } from "./pricing";

// ---------------------------------------------------------------------------
// Margenschutz
// ---------------------------------------------------------------------------

export interface MarginIssue {
  sku: string;
  field: string;
  priceNet: number;
  minimumNet: number;
}

/** Wirft 409 below_margin (mit Details), solange nicht bewusst bestätigt; Bestätigung braucht eigenes Recht. */
export function guardMargin(ctx: AuthContext, issues: MarginIssue[], confirm: boolean): boolean {
  if (issues.length === 0) return false;
  if (!confirm) throw new AppError(409, "below_margin", "below_margin", { issues });
  if (!hasPermission(ctx.permissions, "price.confirm_below_margin")) throw forbidden("cannot_confirm_below_margin");
  return true;
}

async function variantBySku(sku: string, tx: Tx | typeof prisma = prisma) {
  const v = await tx.productVariant.findUnique({ where: { sku }, select: { id: true, sku: true, costPrice: true, b2cPrice: true, b2bBasePrice: true } });
  if (!v) throw badRequest("unknown_sku", { sku });
  return v;
}

function netCheck(sku: string, field: string, priceNet: number, cost: number, minMarginBps: number): MarginIssue[] {
  const minimumNet = minimumPriceNet(cost, minMarginBps);
  return priceNet < minimumNet ? [{ sku, field, priceNet, minimumNet }] : [];
}

// ---------------------------------------------------------------------------
// Preishistorie
// ---------------------------------------------------------------------------

async function recordHistory(
  tx: Tx,
  ctx: AuthContext | null,
  entries: { variantId: string; field: PriceField; oldPrice: number | null; newPrice: number | null; refId?: string | null }[],
  source: PriceChangeSource,
  belowMarginConfirmed: boolean,
  batchId?: string | null,
) {
  const data = entries
    .filter((e) => e.oldPrice !== e.newPrice)
    .map((e) => ({ ...e, source, belowMarginConfirmed, batchId: batchId ?? null, changedById: ctx?.user.id ?? null }));
  if (data.length) await tx.priceHistory.createMany({ data });
}

// ---------------------------------------------------------------------------
// Variantenpreise (Übersicht + Bearbeitung)
// ---------------------------------------------------------------------------

export const PRICE_PAGE_SIZE = 50;

async function categoryWithChildren(categoryId: string): Promise<string[]> {
  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const out = new Set([categoryId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of all) if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
      out.add(c.id);
      added = true;
    }
  }
  return [...out];
}

export async function listVariantPrices(f: { q?: string; categoryId?: string; belowMargin?: "1"; page: number }) {
  const where: Prisma.ProductVariantWhereInput = {
    ...(f.q
      ? {
          OR: [
            { sku: { contains: f.q, mode: "insensitive" } },
            { barcode: { contains: f.q } },
            { product: { nameAr: { contains: f.q, mode: "insensitive" } } },
            { product: { nameEn: { contains: f.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(f.categoryId ? { product: { categoryId: { in: await categoryWithChildren(f.categoryId) } } } : {}),
  };
  const [taxRateBps, minMarginBps] = await Promise.all([currentTaxRateBps(new Date()), getMinMarginBps()]);
  const select = {
    id: true,
    sku: true,
    nameAr: true,
    nameEn: true,
    costPrice: true,
    b2cPrice: true,
    b2bBasePrice: true,
    product: { select: { nameAr: true, nameEn: true, category: { select: { nameAr: true, nameEn: true } } } },
  } as const;
  const enrich = (v: Prisma.ProductVariantGetPayload<{ select: typeof select }>) => {
    const b2cNet = grossToNet(v.b2cPrice, taxRateBps);
    return {
      ...v,
      b2cNet,
      marginB2cBps: marginBpsOf(b2cNet, v.costPrice),
      marginB2bBps: marginBpsOf(v.b2bBasePrice, v.costPrice),
      belowMargin: b2cNet < minimumPriceNet(v.costPrice, minMarginBps) || v.b2bBasePrice < minimumPriceNet(v.costPrice, minMarginBps),
    };
  };
  if (f.belowMargin) {
    const all = (await prisma.productVariant.findMany({ where, select, orderBy: { sku: "asc" } })).map(enrich).filter((v) => v.belowMargin);
    return { items: all.slice((f.page - 1) * PRICE_PAGE_SIZE, f.page * PRICE_PAGE_SIZE), total: all.length, pageSize: PRICE_PAGE_SIZE, taxRateBps, minMarginBps };
  }
  const [items, total] = await prisma.$transaction([
    prisma.productVariant.findMany({ where, select, orderBy: { sku: "asc" }, skip: (f.page - 1) * PRICE_PAGE_SIZE, take: PRICE_PAGE_SIZE }),
    prisma.productVariant.count({ where }),
  ]);
  return { items: items.map(enrich), total, pageSize: PRICE_PAGE_SIZE, taxRateBps, minMarginBps };
}

export async function updateVariantPrices(ctx: AuthContext, variantId: string, input: VariantPriceUpdate) {
  const before = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!before) throw notFound();
  if (input.costPrice !== undefined && !hasPermission(ctx.permissions, "price.view_cost")) throw forbidden();
  const next = {
    costPrice: input.costPrice ?? before.costPrice,
    b2cPrice: input.b2cPrice ?? before.b2cPrice,
    b2bBasePrice: input.b2bBasePrice ?? before.b2bBasePrice,
  };
  const [taxRateBps, minMarginBps] = await Promise.all([currentTaxRateBps(new Date()), getMinMarginBps()]);
  const issues = [
    ...netCheck(before.sku, "B2C", grossToNet(next.b2cPrice, taxRateBps), next.costPrice, minMarginBps),
    ...netCheck(before.sku, "B2B_BASE", next.b2bBasePrice, next.costPrice, minMarginBps),
  ];
  const confirmed = guardMargin(ctx, issues, input.confirmBelowMargin);
  return prisma.$transaction(async (tx) => {
    const after = await tx.productVariant.update({ where: { id: variantId }, data: next });
    await recordHistory(
      tx,
      ctx,
      [
        { variantId, field: "COST", oldPrice: before.costPrice, newPrice: next.costPrice },
        { variantId, field: "B2C", oldPrice: before.b2cPrice, newPrice: next.b2cPrice },
        { variantId, field: "B2B_BASE", oldPrice: before.b2bBasePrice, newPrice: next.b2bBasePrice },
      ],
      "MANUAL",
      confirmed,
    );
    await audit(ctx, { action: "price.update", entityType: "ProductVariant", entityId: variantId, before: { costPrice: before.costPrice, b2cPrice: before.b2cPrice, b2bBasePrice: before.b2bBasePrice }, after: next }, tx);
    return after;
  });
}

// ---------------------------------------------------------------------------
// Regel-Ressourcen (generisches CRUD für Gruppen, Preislisten, Staffeln …)
// ---------------------------------------------------------------------------

type Input<S extends z.ZodType> = z.infer<S>;

interface RuleResource {
  permission: "price.edit" | "price.promotions";
  entityType: string;
  create(ctx: AuthContext, input: unknown, tx: Tx): Promise<{ id: string }>;
  update(ctx: AuthContext, id: string, input: unknown, tx: Tx): Promise<{ id: string }>;
  remove(ctx: AuthContext, id: string, tx: Tx): Promise<unknown>;
  find(id: string): Promise<unknown>;
}

async function marginForNet(ctx: AuthContext, sku: string, priceNet: number, confirm: boolean) {
  const v = await variantBySku(sku);
  const minMarginBps = await getMinMarginBps();
  return { variant: v, confirmed: guardMargin(ctx, netCheck(sku, "NET", priceNet, v.costPrice, minMarginBps), confirm) };
}

export const RULE_RESOURCES: Record<string, RuleResource> = {
  groups: {
    permission: "price.edit",
    entityType: "CustomerGroup",
    find: (id) => prisma.customerGroup.findUnique({ where: { id } }),
    async create(_ctx, raw, tx) {
      const input = raw as Input<typeof groupSchema>;
      if (await tx.customerGroup.findUnique({ where: { code: input.code } })) throw conflict("code_exists");
      return tx.customerGroup.create({ data: input });
    },
    update: (_ctx, id, raw, tx) => tx.customerGroup.update({ where: { id }, data: raw as Input<typeof groupSchema> }),
    async remove(_ctx, id, tx) {
      if (await tx.customer.count({ where: { groupId: id } })) throw new AppError(409, "group_in_use");
      return tx.customerGroup.delete({ where: { id } });
    },
  },
  "price-lists": {
    permission: "price.edit",
    entityType: "PriceList",
    find: (id) => prisma.priceList.findUnique({ where: { id } }),
    async create(_ctx, raw, tx) {
      const input = raw as Input<typeof priceListSchema>;
      if (await tx.priceList.findUnique({ where: { code: input.code } })) throw conflict("code_exists");
      return tx.priceList.create({ data: input });
    },
    update: (_ctx, id, raw, tx) => tx.priceList.update({ where: { id }, data: raw as Input<typeof priceListSchema> }),
    async remove(_ctx, id, tx) {
      if (await tx.customerGroup.count({ where: { priceListId: id } })) throw new AppError(409, "price_list_in_use");
      return tx.priceList.delete({ where: { id } });
    },
  },
  "price-list-items": {
    permission: "price.edit",
    entityType: "PriceListItem",
    find: (id) => prisma.priceListItem.findUnique({ where: { id } }),
    async create(ctx, raw, tx) {
      const { sku, confirmBelowMargin, ...input } = raw as Input<typeof priceListItemSchema>;
      const { variant, confirmed } = await marginForNet(ctx, sku, input.priceNet, confirmBelowMargin);
      const item = await tx.priceListItem.create({ data: { ...input, variantId: variant.id } });
      await recordHistory(tx, ctx, [{ variantId: variant.id, field: "PRICE_LIST_ITEM", oldPrice: null, newPrice: input.priceNet, refId: item.id }], "MANUAL", confirmed);
      return item;
    },
    async update(ctx, id, raw, tx) {
      const { sku, confirmBelowMargin, ...input } = raw as Input<typeof priceListItemSchema>;
      const before = await tx.priceListItem.findUniqueOrThrow({ where: { id } });
      const { variant, confirmed } = await marginForNet(ctx, sku, input.priceNet, confirmBelowMargin);
      const item = await tx.priceListItem.update({ where: { id }, data: { ...input, variantId: variant.id } });
      await recordHistory(tx, ctx, [{ variantId: variant.id, field: "PRICE_LIST_ITEM", oldPrice: before.priceNet, newPrice: input.priceNet, refId: id }], "MANUAL", confirmed);
      return item;
    },
    remove: (_ctx, id, tx) => tx.priceListItem.delete({ where: { id } }),
  },
  tiers: {
    permission: "price.edit",
    entityType: "TierPrice",
    find: (id) => prisma.tierPrice.findUnique({ where: { id } }),
    async create(ctx, raw, tx) {
      const { sku, confirmBelowMargin, ...input } = raw as Input<typeof tierPriceSchema>;
      const { variant, confirmed } = await marginForNet(ctx, sku, input.priceNet, confirmBelowMargin);
      const t = await tx.tierPrice.create({ data: { ...input, variantId: variant.id } });
      await recordHistory(tx, ctx, [{ variantId: variant.id, field: "TIER", oldPrice: null, newPrice: input.priceNet, refId: t.id }], "MANUAL", confirmed);
      return t;
    },
    async update(ctx, id, raw, tx) {
      const { sku, confirmBelowMargin, ...input } = raw as Input<typeof tierPriceSchema>;
      const before = await tx.tierPrice.findUniqueOrThrow({ where: { id } });
      const { variant, confirmed } = await marginForNet(ctx, sku, input.priceNet, confirmBelowMargin);
      const t = await tx.tierPrice.update({ where: { id }, data: { ...input, variantId: variant.id } });
      await recordHistory(tx, ctx, [{ variantId: variant.id, field: "TIER", oldPrice: before.priceNet, newPrice: input.priceNet, refId: id }], "MANUAL", confirmed);
      return t;
    },
    remove: (_ctx, id, tx) => tx.tierPrice.delete({ where: { id } }),
  },
  "customer-prices": {
    permission: "price.edit",
    entityType: "CustomerPrice",
    find: (id) => prisma.customerPrice.findUnique({ where: { id } }),
    async create(ctx, raw, tx) {
      const { sku, confirmBelowMargin, ...input } = raw as Input<typeof customerPriceSchema>;
      if (!(await tx.customer.findFirst({ where: { id: input.customerId, type: "B2B" } }))) throw badRequest("not_b2b");
      const { variant, confirmed } = await marginForNet(ctx, sku, input.priceNet, confirmBelowMargin);
      const cp = await tx.customerPrice.create({ data: { ...input, variantId: variant.id } });
      await recordHistory(tx, ctx, [{ variantId: variant.id, field: "CUSTOMER_PRICE", oldPrice: null, newPrice: input.priceNet, refId: cp.id }], "MANUAL", confirmed);
      return cp;
    },
    async update(ctx, id, raw, tx) {
      const { sku, confirmBelowMargin, ...input } = raw as Input<typeof customerPriceSchema>;
      const before = await tx.customerPrice.findUniqueOrThrow({ where: { id } });
      const { variant, confirmed } = await marginForNet(ctx, sku, input.priceNet, confirmBelowMargin);
      const cp = await tx.customerPrice.update({ where: { id }, data: { ...input, variantId: variant.id } });
      await recordHistory(tx, ctx, [{ variantId: variant.id, field: "CUSTOMER_PRICE", oldPrice: before.priceNet, newPrice: input.priceNet, refId: id }], "MANUAL", confirmed);
      return cp;
    },
    remove: (_ctx, id, tx) => tx.customerPrice.delete({ where: { id } }),
  },
  "category-discounts": {
    permission: "price.edit",
    entityType: "CategoryDiscount",
    find: (id) => prisma.categoryDiscount.findUnique({ where: { id } }),
    create: (_ctx, raw, tx) => tx.categoryDiscount.create({ data: raw as Input<typeof categoryDiscountSchema> }),
    update: (_ctx, id, raw, tx) => tx.categoryDiscount.update({ where: { id }, data: raw as Input<typeof categoryDiscountSchema> }),
    remove: (_ctx, id, tx) => tx.categoryDiscount.delete({ where: { id } }),
  },
  promotions: {
    permission: "price.promotions",
    entityType: "Promotion",
    find: (id) => prisma.promotion.findUnique({ where: { id }, include: { targets: true } }),
    async create(_ctx, raw, tx) {
      const { targetSku, targetCategoryId, fixedPrice, ...input } = raw as Input<typeof promotionSchema>;
      const variant = targetSku ? await variantBySku(targetSku, tx) : null;
      return tx.promotion.create({
        data: { ...input, targets: { create: { variantId: variant?.id, categoryId: targetCategoryId, fixedPrice: fixedPrice ?? null } } },
      });
    },
    async update(_ctx, id, raw, tx) {
      const { targetSku, targetCategoryId, fixedPrice, ...input } = raw as Input<typeof promotionSchema>;
      const variant = targetSku ? await variantBySku(targetSku, tx) : null;
      await tx.promotionTarget.deleteMany({ where: { promotionId: id } });
      return tx.promotion.update({
        where: { id },
        data: { ...input, targets: { create: { variantId: variant?.id, categoryId: targetCategoryId, fixedPrice: fixedPrice ?? null } } },
      });
    },
    remove: (_ctx, id, tx) => tx.promotion.delete({ where: { id } }),
  },
  rounding: {
    permission: "price.edit",
    entityType: "RoundingRule",
    find: (id) => prisma.roundingRule.findUnique({ where: { id } }),
    create: (_ctx, raw, tx) => tx.roundingRule.create({ data: { ...(raw as Input<typeof roundingRuleSchema>), channel: "B2C" } }),
    update: (_ctx, id, raw, tx) => tx.roundingRule.update({ where: { id }, data: raw as Input<typeof roundingRuleSchema> }),
    remove: (_ctx, id, tx) => tx.roundingRule.delete({ where: { id } }),
  },
  scheduled: {
    permission: "price.edit",
    entityType: "ScheduledPriceChange",
    find: (id) => prisma.scheduledPriceChange.findUnique({ where: { id } }),
    async create(ctx, raw, tx) {
      const { sku, ...input } = raw as Input<typeof scheduledPriceSchema>;
      const v = await variantBySku(sku, tx);
      if (input.effectiveAt <= new Date()) throw badRequest("date_must_be_future");
      return tx.scheduledPriceChange.create({ data: { ...input, variantId: v.id, createdById: ctx.user.id } });
    },
    async update() {
      throw new AppError(405, "not_editable");
    },
    async remove(_ctx, id, tx) {
      const s = await tx.scheduledPriceChange.findUniqueOrThrow({ where: { id } });
      if (s.appliedAt) throw new AppError(409, "already_applied");
      return tx.scheduledPriceChange.update({ where: { id }, data: { cancelledAt: new Date() } });
    },
  },
};

export async function createRule(ctx: AuthContext, resource: string, input: unknown) {
  const r = RULE_RESOURCES[resource];
  if (!r) throw notFound();
  return prisma.$transaction(async (tx) => {
    const created = await r.create(ctx, input, tx);
    await audit(ctx, { action: `price.${resource}.create`, entityType: r.entityType, entityId: created.id, after: created }, tx);
    return created;
  });
}

export async function updateRule(ctx: AuthContext, resource: string, id: string, input: unknown) {
  const r = RULE_RESOURCES[resource];
  if (!r) throw notFound();
  const before = await r.find(id);
  if (!before) throw notFound();
  return prisma.$transaction(async (tx) => {
    const updated = await r.update(ctx, id, input, tx);
    await audit(ctx, { action: `price.${resource}.update`, entityType: r.entityType, entityId: id, before, after: updated }, tx);
    return updated;
  });
}

export async function deleteRule(ctx: AuthContext, resource: string, id: string) {
  const r = RULE_RESOURCES[resource];
  if (!r) throw notFound();
  const before = await r.find(id);
  if (!before) throw notFound();
  await prisma.$transaction(async (tx) => {
    await r.remove(ctx, id, tx);
    await audit(ctx, { action: `price.${resource}.delete`, entityType: r.entityType, entityId: id, before }, tx);
  });
}

// ---------------------------------------------------------------------------
// Geplante Preise anwenden (Job, alle 5 Minuten + manuell)
// ---------------------------------------------------------------------------

const FIELD_COLUMN = { COST: "costPrice", B2C: "b2cPrice", B2B_BASE: "b2bBasePrice" } as const;

export async function applyDueScheduledPrices(now = new Date()): Promise<number> {
  const due = await prisma.scheduledPriceChange.findMany({
    where: { appliedAt: null, cancelledAt: null, effectiveAt: { lte: now } },
    orderBy: { effectiveAt: "asc" },
  });
  for (const s of due) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.scheduledPriceChange.findUnique({ where: { id: s.id } });
      if (!fresh || fresh.appliedAt || fresh.cancelledAt) return;
      const column = FIELD_COLUMN[s.field as keyof typeof FIELD_COLUMN];
      if (!column) return;
      const v = await tx.productVariant.findUniqueOrThrow({ where: { id: s.variantId } });
      await tx.productVariant.update({ where: { id: s.variantId }, data: { [column]: s.newPrice } });
      await recordHistory(tx, null, [{ variantId: s.variantId, field: s.field, oldPrice: v[column], newPrice: s.newPrice }], "SCHEDULED", false, s.batchId);
      await tx.scheduledPriceChange.update({ where: { id: s.id }, data: { appliedAt: new Date() } });
      await audit(null, { action: "price.scheduled.apply", entityType: "ProductVariant", entityId: s.variantId, before: { [column]: v[column] }, after: { [column]: s.newPrice } }, tx);
    });
  }
  return due.length;
}

// ---------------------------------------------------------------------------
// Massenänderung „Kategorie X um Y %“
// ---------------------------------------------------------------------------

export async function bulkAdjustPrices(ctx: AuthContext, input: z.infer<typeof bulkAdjustSchema>) {
  if (input.field === "COST" && !hasPermission(ctx.permissions, "price.view_cost")) throw forbidden();
  const where: Prisma.ProductVariantWhereInput = input.categoryId
    ? { product: { categoryId: { in: await categoryWithChildren(input.categoryId) } } }
    : {};
  const variants = await prisma.productVariant.findMany({
    where,
    select: { id: true, sku: true, costPrice: true, b2cPrice: true, b2bBasePrice: true, product: { select: { nameAr: true, nameEn: true } } },
    orderBy: { sku: "asc" },
  });
  const [taxRateBps, minMarginBps] = await Promise.all([currentTaxRateBps(new Date()), getMinMarginBps()]);
  const column = FIELD_COLUMN[input.field];
  const rounding: RoundingModeKey | null = input.field === "B2C" && input.rounding !== "NONE" ? input.rounding : null;
  const rows = variants.map((v) => {
    const oldPrice = v[column];
    const newPrice = bulkAdjust(oldPrice, input.changeBps, rounding);
    const next = { ...v, [column]: newPrice };
    const issues = [
      ...netCheck(v.sku, "B2C", grossToNet(next.b2cPrice, taxRateBps), next.costPrice, minMarginBps),
      ...netCheck(v.sku, "B2B_BASE", next.b2bBasePrice, next.costPrice, minMarginBps),
    ];
    return { variantId: v.id, sku: v.sku, nameAr: v.product.nameAr, nameEn: v.product.nameEn, oldPrice, newPrice, belowMargin: issues.length > 0, issues };
  });
  if (!input.apply) return { applied: false, rows };

  const confirmed = guardMargin(ctx, rows.flatMap((r) => r.issues), input.confirmBelowMargin);
  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.priceChangeBatch.create({
      data: { source: "BULK_PERCENT", description: `${input.field} ${input.changeBps}bps`, meta: { ...input, effectiveAt: input.effectiveAt?.toISOString() ?? null }, createdById: ctx.user.id },
    });
    if (input.effectiveAt) {
      await tx.scheduledPriceChange.createMany({
        data: rows.filter((r) => r.oldPrice !== r.newPrice).map((r) => ({ variantId: r.variantId, field: input.field, newPrice: r.newPrice, effectiveAt: input.effectiveAt!, batchId: batch.id, createdById: ctx.user.id })),
      });
    } else {
      for (const r of rows) {
        if (r.oldPrice === r.newPrice) continue;
        await tx.productVariant.update({ where: { id: r.variantId }, data: { [column]: r.newPrice } });
      }
      await recordHistory(tx, ctx, rows.map((r) => ({ variantId: r.variantId, field: input.field, oldPrice: r.oldPrice, newPrice: r.newPrice })), "BULK_PERCENT", confirmed, batch.id);
    }
    await audit(ctx, { action: "price.bulk", entityType: "PriceChangeBatch", entityId: batch.id, after: { ...input, count: rows.length } }, tx);
    return batch;
  });
  return { applied: true, scheduled: !!input.effectiveAt, batchId: result.id, rows };
}

// ---------------------------------------------------------------------------
// Import / Export (CSV + Excel)
// ---------------------------------------------------------------------------

export const PRICE_COLUMNS = ["sku", "name_ar", "name_en", "cost_price", "b2c_price", "b2b_base_price"] as const;

export async function exportPriceRows(includeCost: boolean) {
  const variants = await prisma.productVariant.findMany({
    select: { sku: true, nameAr: true, nameEn: true, costPrice: true, b2cPrice: true, b2bBasePrice: true, product: { select: { nameAr: true, nameEn: true } } },
    orderBy: { sku: "asc" },
  });
  return variants.map((v) => ({
    sku: v.sku,
    name_ar: [v.product.nameAr, v.nameAr].filter(Boolean).join(" – "),
    name_en: [v.product.nameEn, v.nameEn].filter(Boolean).join(" – "),
    cost_price: includeCost ? formatMoney(v.costPrice, { symbol: false, grouping: false }) : "",
    b2c_price: formatMoney(v.b2cPrice, { symbol: false, grouping: false }),
    b2b_base_price: formatMoney(v.b2bBasePrice, { symbol: false, grouping: false }),
  }));
}

export function toCsv(rows: Record<string, string>[], columns: readonly string[]): string {
  const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // BOM, damit Excel UTF-8 (Arabisch) korrekt öffnet
  return "﻿" + [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c] ?? "")).join(","))].join("\r\n") + "\r\n";
}

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

export interface ImportDiffRow {
  line: number;
  sku: string;
  variantId?: string;
  changes: { field: "COST" | "B2C" | "B2B_BASE"; oldPrice: number; newPrice: number }[];
  error?: string;
  belowMargin?: boolean;
}

export async function diffPriceImport(rows: Record<string, string>[], includeCost: boolean): Promise<ImportDiffRow[]> {
  const skus = rows.map((r) => r.sku ?? "").filter(Boolean);
  const variants = new Map(
    (await prisma.productVariant.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true, costPrice: true, b2cPrice: true, b2bBasePrice: true } })).map((v) => [v.sku, v]),
  );
  const [taxRateBps, minMarginBps] = await Promise.all([currentTaxRateBps(new Date()), getMinMarginBps()]);
  return rows.map((r, i) => {
    const line = i + 2;
    const sku = r.sku ?? "";
    const v = variants.get(sku);
    if (!v) return { line, sku, changes: [], error: "unknown_sku" };
    const changes: ImportDiffRow["changes"] = [];
    const parse = (key: string) => {
      const raw = r[key];
      if (raw === undefined || raw === "") return null;
      const value = parseShekel(raw);
      if (value < 0) throw new Error("negative");
      return value;
    };
    try {
      const cost = includeCost ? parse("cost_price") : null;
      const b2c = parse("b2c_price");
      const b2b = parse("b2b_base_price");
      if (cost !== null && cost !== v.costPrice) changes.push({ field: "COST", oldPrice: v.costPrice, newPrice: cost });
      if (b2c !== null && b2c !== v.b2cPrice) changes.push({ field: "B2C", oldPrice: v.b2cPrice, newPrice: b2c });
      if (b2b !== null && b2b !== v.b2bBasePrice) changes.push({ field: "B2B_BASE", oldPrice: v.b2bBasePrice, newPrice: b2b });
      const next = { costPrice: cost ?? v.costPrice, b2cPrice: b2c ?? v.b2cPrice, b2bBasePrice: b2b ?? v.b2bBasePrice };
      const belowMargin =
        grossToNet(next.b2cPrice, taxRateBps) < minimumPriceNet(next.costPrice, minMarginBps) ||
        next.b2bBasePrice < minimumPriceNet(next.costPrice, minMarginBps);
      return { line, sku, variantId: v.id, changes, belowMargin: changes.length > 0 && belowMargin };
    } catch {
      return { line, sku, changes: [], error: "invalid_amount" };
    }
  });
}

export async function applyPriceImport(ctx: AuthContext, diff: ImportDiffRow[], fileName: string, confirmBelowMargin: boolean) {
  if (diff.some((d) => d.error)) throw badRequest("import_has_errors");
  const changed = diff.filter((d) => d.changes.length > 0);
  const issues = changed.filter((d) => d.belowMargin).map((d) => ({ sku: d.sku, field: "IMPORT", priceNet: 0, minimumNet: 0 }));
  const confirmed = guardMargin(ctx, issues, confirmBelowMargin);
  return prisma.$transaction(async (tx) => {
    const batch = await tx.priceChangeBatch.create({
      data: { source: "CSV_IMPORT", description: fileName.slice(0, 200), meta: { rows: diff.length, changed: changed.length }, createdById: ctx.user.id },
    });
    for (const d of changed) {
      const data = Object.fromEntries(d.changes.map((c) => [FIELD_COLUMN[c.field], c.newPrice]));
      await tx.productVariant.update({ where: { id: d.variantId! }, data });
      await recordHistory(tx, ctx, d.changes.map((c) => ({ variantId: d.variantId!, field: c.field, oldPrice: c.oldPrice, newPrice: c.newPrice })), "CSV_IMPORT", confirmed, batch.id);
    }
    await audit(ctx, { action: "price.import", entityType: "PriceChangeBatch", entityId: batch.id, after: { file: fileName, changed: changed.length } }, tx);
    return { batchId: batch.id, changed: changed.length };
  });
}

// ---------------------------------------------------------------------------
// Preisvorschau (Kunde + Menge → Endpreis mit Begründung)
// ---------------------------------------------------------------------------

export async function previewPrice(input: { sku: string; customerId?: string; channel?: "B2C" | "B2B"; qtyBase: number; date: Date | null }): Promise<{
  result: PriceResult;
  channel: "B2C" | "B2B";
  customer: { id: string; displayName: string; type: string; status: string } | null;
  minimumNet: number;
}> {
  const v = await variantBySku(input.sku);
  const date = input.date ?? new Date();
  let channel: "B2C" | "B2B" = input.channel ?? "B2C";
  let customerRow: { id: string; displayName: string; type: string; status: string } | null = null;
  if (input.customerId) {
    customerRow = await prisma.customer.findUnique({ where: { id: input.customerId }, select: { id: true, displayName: true, type: true, status: true } });
    if (!customerRow) throw badRequest("unknown_customer");
    channel = customerRow.type === "B2B" && customerRow.status === "ACTIVE" ? "B2B" : "B2C";
  }
  const customer = channel === "B2B" ? await loadPricingCustomer(input.customerId ?? null) : null;
  const products = await loadPricingProducts([v.id], customer, date, channel);
  const result = resolvePrice(products.get(v.id)!, customer, input.qtyBase, date, channel);
  return { result, channel, customer: customerRow, minimumNet: minimumPriceNet(v.costPrice, await getMinMarginBps()) };
}

// ---------------------------------------------------------------------------
// Historie
// ---------------------------------------------------------------------------

export async function listPriceHistory(f: { sku?: string; page: number }) {
  const where: Prisma.PriceHistoryWhereInput = f.sku ? { variant: { sku: { contains: f.sku, mode: "insensitive" } } } : {};
  const [items, total] = await prisma.$transaction([
    prisma.priceHistory.findMany({
      where,
      orderBy: { changedAt: "desc" },
      skip: (f.page - 1) * 50,
      take: 50,
      include: { variant: { select: { sku: true } }, changedBy: { select: { name: true } }, batch: { select: { source: true, description: true } } },
    }),
    prisma.priceHistory.count({ where }),
  ]);
  return { items, total, pageSize: 50 };
}
