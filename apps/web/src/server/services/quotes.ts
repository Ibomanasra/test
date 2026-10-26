import "server-only";
import type { z } from "zod";
import type { quoteCreateSchema, quoteRequestSchema } from "@sa/contracts";
import { lineFromNet, minimumPriceNet, sumTaxLines } from "@sa/core";
import { allocateDocumentNumber, prisma, type Prisma, type QuoteStatus, type Tx } from "@sa/db";
import { smsAdapter } from "../adapters/sms";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, notFound } from "../errors";
import { guardMargin, type MarginIssue } from "./prices-admin";
import { currentTaxRateBps, getMinMarginBps, priceItems, priceKey } from "./pricing";

type QuoteInput = z.infer<typeof quoteCreateSchema>;

async function resolveItems(tx: Tx, items: QuoteInput["items"]) {
  const variants = await tx.productVariant.findMany({
    where: { sku: { in: items.map((i) => i.sku) } },
    include: { units: { include: { unit: true } } },
  });
  return items.map((i, idx) => {
    const v = variants.find((x) => x.sku === i.sku);
    if (!v) throw badRequest("unknown_sku", { sku: i.sku });
    const unit = v.units.find((u) => u.unit.code === i.unitCode);
    if (!unit) throw badRequest("invalid_unit", { sku: i.sku, unit: i.unitCode });
    return { variant: v, unitCode: i.unitCode, unitFactor: unit.factor, qty: i.qty, unitPriceNet: i.unitPriceNet, sortOrder: idx };
  });
}

async function totals(items: { unitPriceNet: number; qty: number; unitFactor: number }[]) {
  const rate = await currentTaxRateBps(new Date());
  return sumTaxLines(items.map((i) => lineFromNet(i.unitPriceNet, i.qty * i.unitFactor, rate)));
}

const quoteInclude = {
  customer: { select: { id: true, number: true, displayName: true, type: true } },
  createdBy: { select: { name: true } },
  items: { include: { variant: { select: { sku: true, nameAr: true, nameEn: true, costPrice: true, product: { select: { nameAr: true, nameEn: true } } } } }, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.QuoteInclude;

export async function listQuotes(f: { status?: QuoteStatus; customerId?: string; page: number }) {
  const where: Prisma.QuoteWhereInput = { status: f.status, customerId: f.customerId };
  const [items, total] = await prisma.$transaction([
    prisma.quote.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * 25, take: 25, include: { customer: { select: { displayName: true, number: true } } } }),
    prisma.quote.count({ where }),
  ]);
  return { items, total, pageSize: 25 };
}

export async function getQuote(id: string, customerId?: string) {
  const q = await prisma.quote.findFirst({ where: { id, customerId }, include: quoteInclude });
  if (!q) throw notFound();
  return q;
}

async function marginIssues(items: Awaited<ReturnType<typeof resolveItems>>): Promise<MarginIssue[]> {
  const min = await getMinMarginBps();
  return items
    .filter((i) => i.unitPriceNet < minimumPriceNet(i.variant.costPrice, min))
    .map((i) => ({ sku: i.variant.sku, field: "QUOTE", priceNet: i.unitPriceNet, minimumNet: minimumPriceNet(i.variant.costPrice, min) }));
}

export async function createQuote(ctx: AuthContext, input: QuoteInput & { confirmBelowMargin?: boolean }) {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer || customer.type !== "B2B") throw badRequest("not_b2b");
  return prisma.$transaction(async (tx) => {
    const items = await resolveItems(tx, input.items);
    guardMargin(ctx, await marginIssues(items), !!input.confirmBelowMargin);
    const t = await totals(items);
    const { number } = await allocateDocumentNumber(tx, "QUOTE");
    const quote = await tx.quote.create({
      data: {
        number,
        customerId: input.customerId,
        status: "DRAFT",
        validUntil: input.validUntil,
        isFixed: input.isFixed,
        internalNote: input.internalNote,
        createdById: ctx.user.id,
        subtotalNet: t.net,
        vatTotal: t.vat,
        totalGross: t.gross,
        items: { create: items.map((i) => ({ variantId: i.variant.id, unitCode: i.unitCode, unitFactor: i.unitFactor, qty: i.qty, unitPriceNet: i.unitPriceNet, sortOrder: i.sortOrder })) },
      },
    });
    await audit(ctx, { action: "quote.create", entityType: "Quote", entityId: quote.id, after: quote }, tx);
    return quote;
  });
}

/** Positionen/Konditionen ersetzen – nur solange nicht versendet oder angefragt */
export async function updateQuote(ctx: AuthContext, id: string, input: Omit<QuoteInput, "customerId"> & { confirmBelowMargin?: boolean }) {
  const before = await prisma.quote.findUnique({ where: { id }, include: { items: true } });
  if (!before) throw notFound();
  if (!["DRAFT", "REQUESTED"].includes(before.status)) throw new AppError(409, "invalid_status");
  return prisma.$transaction(async (tx) => {
    const items = await resolveItems(tx, input.items);
    guardMargin(ctx, await marginIssues(items), !!input.confirmBelowMargin);
    const t = await totals(items);
    await tx.quoteItem.deleteMany({ where: { quoteId: id } });
    const quote = await tx.quote.update({
      where: { id },
      data: {
        status: "DRAFT",
        validUntil: input.validUntil,
        isFixed: input.isFixed,
        internalNote: input.internalNote,
        subtotalNet: t.net,
        vatTotal: t.vat,
        totalGross: t.gross,
        createdById: before.createdById ?? ctx.user.id,
        items: { create: items.map((i) => ({ variantId: i.variant.id, unitCode: i.unitCode, unitFactor: i.unitFactor, qty: i.qty, unitPriceNet: i.unitPriceNet, sortOrder: i.sortOrder })) },
      },
    });
    await audit(ctx, { action: "quote.update", entityType: "Quote", entityId: id, before, after: quote }, tx);
    return quote;
  });
}

export async function sendQuote(ctx: AuthContext, id: string) {
  const q = await prisma.quote.findUnique({ where: { id }, include: { customer: true, _count: { select: { items: true } } } });
  if (!q) throw notFound();
  if (q.status !== "DRAFT") throw new AppError(409, "invalid_status");
  if (q._count.items === 0) throw badRequest("quote_empty");
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.quote.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    await audit(ctx, { action: "quote.send", entityType: "Quote", entityId: id, before: { status: q.status }, after: { status: "SENT" } }, tx);
    return u;
  });
  if (q.customer.phone) {
    const ar = q.customer.preferredLocale === "ar";
    await smsAdapter().send({
      to: q.customer.phone,
      template: "quote.sent",
      locale: q.customer.preferredLocale,
      text: ar ? `عرض سعر جديد ${q.number} بانتظارك في حسابك لدى شعلة الجنوب.` : `New quote ${q.number} is waiting in your Sholat Aljanoub account.`,
      payload: { quoteId: id },
    });
  }
  return updated;
}

export async function cancelQuote(ctx: AuthContext, id: string) {
  const q = await prisma.quote.findUnique({ where: { id } });
  if (!q) throw notFound();
  if (["CONVERTED", "REJECTED"].includes(q.status)) throw new AppError(409, "invalid_status");
  return prisma.$transaction(async (tx) => {
    const u = await tx.quote.update({ where: { id }, data: { status: "REJECTED" } });
    await audit(ctx, { action: "quote.cancel", entityType: "Quote", entityId: id, before: { status: q.status }, after: { status: "REJECTED" } }, tx);
    return u;
  });
}

/** Kunde nimmt an / lehnt ab */
export async function respondToQuote(ctx: AuthContext, customerId: string, id: string, accept: boolean) {
  const q = await prisma.quote.findFirst({ where: { id, customerId } });
  if (!q) throw notFound();
  if (q.status !== "SENT") throw new AppError(409, "invalid_status");
  if (accept && q.validUntil <= new Date()) {
    await prisma.quote.update({ where: { id }, data: { status: "EXPIRED" } });
    throw new AppError(409, "quote_expired");
  }
  const status: QuoteStatus = accept ? "ACCEPTED" : "REJECTED";
  return prisma.$transaction(async (tx) => {
    const u = await tx.quote.update({ where: { id }, data: { status, acceptedAt: accept ? new Date() : null } });
    await audit(ctx, { action: accept ? "quote.accept" : "quote.reject", entityType: "Quote", entityId: id, before: { status: q.status }, after: { status } }, tx);
    return u;
  });
}

/** Kunde fragt ein Angebot an; Positionen erhalten seinen aktuellen Preis als Vorschlag. */
export async function requestQuote(ctx: AuthContext, customerId: string, input: z.infer<typeof quoteRequestSchema>) {
  const variants = await prisma.productVariant.findMany({ where: { sku: { in: input.items.map((i) => i.sku) } }, select: { id: true, sku: true } });
  const prices = await priceItems(
    input.items.flatMap((i) => {
      const v = variants.find((x) => x.sku === i.sku);
      return v ? [{ variantId: v.id, qtyBase: i.qty }] : [];
    }),
    { channel: "B2B", customerId },
  );
  const quoteValidity = (await prisma.companySettings.findUnique({ where: { id: 1 } }))?.quoteValidityDays ?? 14;
  return prisma.$transaction(async (tx) => {
    const { number } = await allocateDocumentNumber(tx, "QUOTE");
    const items = input.items.flatMap((i, idx) => {
      const v = variants.find((x) => x.sku === i.sku);
      const p = v ? prices.get(priceKey(v.id, i.qty)) : undefined;
      return v && p ? [{ variantId: v.id, unitCode: "PIECE", unitFactor: 1, qty: i.qty, unitPriceNet: p.unitNet, sortOrder: idx }] : [];
    });
    const t = await totals(items);
    const quote = await tx.quote.create({
      data: {
        number,
        customerId,
        status: "REQUESTED",
        requestNote: input.note,
        validUntil: new Date(Date.now() + quoteValidity * 86_400_000),
        subtotalNet: t.net,
        vatTotal: t.vat,
        totalGross: t.gross,
        items: { create: items },
      },
    });
    await audit(ctx, { action: "quote.request", entityType: "Quote", entityId: quote.id, after: quote }, tx);
    return quote;
  });
}

/** Abgelaufene Angebote markieren (Job) */
export async function expireQuotes(now = new Date()) {
  const r = await prisma.quote.updateMany({ where: { status: "SENT", validUntil: { lte: now } }, data: { status: "EXPIRED" } });
  return r.count;
}
