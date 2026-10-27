import "server-only";
import { prisma } from "@sa/db";
import { badRequest, notFound } from "../errors";
import { addCartItem, findCart, type CartOwner } from "./cart";

/** Gespeicherte Bestelllisten (B2B) */
export function listOrderLists(customerId: string) {
  return prisma.savedOrderList.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { variant: { select: { sku: true, nameAr: true, nameEn: true, product: { select: { nameAr: true, nameEn: true } } } } } } },
  });
}

export async function saveCartAsList(owner: CartOwner, name: string) {
  if (!owner.customerId) throw badRequest("b2b_only");
  const cart = await findCart(owner);
  const items = cart ? await prisma.cartItem.findMany({ where: { cartId: cart.id } }) : [];
  if (items.length === 0) throw badRequest("cart_empty");
  return prisma.savedOrderList.create({
    data: { customerId: owner.customerId, name, items: { create: items.map((i) => ({ variantId: i.variantId, unitCode: i.unitCode, qty: i.qty })) } },
  });
}

export async function addListToCart(owner: CartOwner, listId: string) {
  const list = await prisma.savedOrderList.findFirst({ where: { id: listId, customerId: owner.customerId ?? "-" }, include: { items: true } });
  if (!list) throw notFound();
  for (const i of list.items) await addCartItem(owner, { variantId: i.variantId, unitCode: i.unitCode, qty: i.qty });
}

export async function deleteList(customerId: string, listId: string) {
  const r = await prisma.savedOrderList.deleteMany({ where: { id: listId, customerId } });
  if (r.count === 0) throw notFound();
}

export interface QuickOrderResult {
  added: { sku: string; qty: number; unitCode: string }[];
  errors: { line: number; text: string; code: string }[];
}

/**
 * Schnellbestellung: Zeilen "SKU Menge [Einheit]" oder CSV (sku,qty[,unit]).
 * Ohne Einheit gilt die Standard-Einheit des Kanals (B2B: Karton).
 */
export async function quickOrder(owner: CartOwner, text: string): Promise<QuickOrderResult> {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l, i) => ({ line: i + 1, raw: l.trim() }))
    .filter((l) => l.raw && !/^sku[,;\s]/i.test(l.raw));
  if (lines.length > 500) throw badRequest("too_many_rows");
  const parsed = lines.map((l) => {
    const [sku, qty, unit] = l.raw.split(/[\s,;\t]+/);
    return { ...l, sku: sku ?? "", qty: Number(qty ?? 1), unit: unit?.toUpperCase() };
  });
  const variants = await prisma.productVariant.findMany({
    where: { OR: [{ sku: { in: parsed.map((p) => p.sku) } }, { barcode: { in: parsed.map((p) => p.sku) } }] },
    select: { id: true, sku: true, barcode: true, units: { select: { unit: { select: { id: true, code: true } } } }, channelRules: { select: { channel: true, defaultUnitId: true } } },
  });
  const result: QuickOrderResult = { added: [], errors: [] };
  for (const p of parsed) {
    const v = variants.find((x) => x.sku === p.sku || x.barcode === p.sku);
    if (!v) {
      result.errors.push({ line: p.line, text: p.raw, code: "unknown_sku" });
      continue;
    }
    if (!Number.isInteger(p.qty) || p.qty < 1) {
      result.errors.push({ line: p.line, text: p.raw, code: "invalid_quantity" });
      continue;
    }
    const rule = v.channelRules.find((r) => r.channel === owner.channel);
    const unitCode = p.unit ?? v.units.find((u) => u.unit.id === rule?.defaultUnitId)?.unit.code ?? "PIECE";
    try {
      await addCartItem(owner, { variantId: v.id, unitCode, qty: p.qty });
      result.added.push({ sku: v.sku, qty: p.qty, unitCode });
    } catch (err) {
      result.errors.push({ line: p.line, text: p.raw, code: (err as { code?: string }).code ?? "error" });
    }
  }
  return result;
}
