import "server-only";
import { checkQuantity, computeCheckout, lineFor, type PricingChannel, type QuantityProblem } from "@sa/core";
import { prisma } from "@sa/db";
import { cookies } from "next/headers";
import { randomToken } from "../crypto";
import { env } from "../env";
import { badRequest, notFound } from "../errors";
import type { AuthContext } from "../auth/context";
import { availabilityOf } from "./catalog";
import { currentTaxRateBps, priceItems, priceKey } from "./pricing";

/**
 * Warenkorb: speichert nur Variante, Einheit und Menge – NIE Preise.
 * Preise werden bei jedem Abruf serverseitig für den Kanal des Betrachters berechnet.
 * Gäste: Cookie "sa_cart" (Zufallstoken); beim Login wird der Gast-Korb übernommen.
 */

export const CART_COOKIE = "sa_cart";

export interface CartOwner {
  customerId: string | null;
  channel: PricingChannel;
}

export function cartOwner(ctx: AuthContext | null): CartOwner {
  return { customerId: ctx?.customer?.id ?? null, channel: ctx?.channel ?? "B2C" };
}

async function guestToken(create: boolean): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(CART_COOKIE)?.value;
  if (existing || !create) return existing ?? null;
  const token = randomToken(24);
  jar.set(CART_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: env().COOKIE_SECURE, path: "/", maxAge: 60 * 60 * 24 * 30 });
  return token;
}

export async function findCart(owner: CartOwner, create = false) {
  if (owner.customerId) {
    const c = await prisma.cart.findFirst({ where: { customerId: owner.customerId }, orderBy: { updatedAt: "desc" } });
    if (c || !create) return c;
    return prisma.cart.create({ data: { customerId: owner.customerId } });
  }
  const token = await guestToken(create);
  if (!token) return null;
  const c = await prisma.cart.findUnique({ where: { guestToken: token } });
  if (c || !create) return c;
  return prisma.cart.create({ data: { guestToken: token } });
}

/** Gast-Warenkorb in den Kunden-Warenkorb übernehmen (nach Login/Registrierung). */
export async function mergeGuestCart(customerId: string) {
  const token = await guestToken(false);
  if (!token) return;
  const guest = await prisma.cart.findUnique({ where: { guestToken: token }, include: { items: true } });
  if (!guest) return;
  const target = (await prisma.cart.findFirst({ where: { customerId } })) ?? (await prisma.cart.create({ data: { customerId } }));
  for (const i of guest.items) {
    await prisma.cartItem.upsert({
      where: { cartId_variantId_unitCode: { cartId: target.id, variantId: i.variantId, unitCode: i.unitCode } },
      create: { cartId: target.id, variantId: i.variantId, unitCode: i.unitCode, qty: i.qty },
      update: { qty: { increment: i.qty } },
    });
  }
  await prisma.cart.delete({ where: { id: guest.id } });
  (await cookies()).delete(CART_COOKIE);
}

async function variantForCart(variantId: string, unitCode: string, channel: PricingChannel) {
  const v = await prisma.productVariant.findFirst({
    where: { id: variantId, active: true, product: { active: true, ...(channel === "B2B" ? { visibleB2B: true } : { visibleB2C: true }) } },
    select: { id: true, units: { select: { factor: true, unit: { select: { id: true, code: true } } } }, channelRules: true },
  });
  if (!v) throw notFound("product_not_available");
  const unit = v.units.find((u) => u.unit.code === unitCode);
  const rule = v.channelRules.find((r) => r.channel === channel);
  if (!unit || (rule?.allowedUnitIds.length && !rule.allowedUnitIds.includes(unit.unit.id))) throw badRequest("invalid_unit");
  return { factor: unit.factor, rule };
}

export async function addCartItem(owner: CartOwner, input: { variantId: string; unitCode: string; qty: number }) {
  await variantForCart(input.variantId, input.unitCode, owner.channel);
  const cart = (await findCart(owner, true))!;
  await prisma.cartItem.upsert({
    where: { cartId_variantId_unitCode: { cartId: cart.id, variantId: input.variantId, unitCode: input.unitCode } },
    create: { cartId: cart.id, variantId: input.variantId, unitCode: input.unitCode, qty: input.qty },
    update: { qty: { increment: input.qty } },
  });
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  return cart.id;
}

export async function setCartItemQty(owner: CartOwner, itemId: string, qty: number) {
  const cart = await findCart(owner);
  const item = cart ? await prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } }) : null;
  if (!item) throw notFound();
  if (qty <= 0) await prisma.cartItem.delete({ where: { id: itemId } });
  else await prisma.cartItem.update({ where: { id: itemId }, data: { qty } });
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
  await prisma.cart.update({ where: { id: cartId }, data: { quoteId: null } });
}

/** Angebot übernehmen: Positionen in den Warenkorb, Angebotspreise gelten (nur B2B). */
export async function applyQuoteToCart(owner: CartOwner, quoteId: string) {
  if (!owner.customerId || owner.channel !== "B2B") throw badRequest("b2b_only");
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, customerId: owner.customerId, status: "ACCEPTED", validUntil: { gt: new Date() } }, include: { items: true } });
  if (!quote) throw notFound("quote_not_available");
  const cart = (await findCart(owner, true))!;
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    prisma.cart.update({ where: { id: cart.id }, data: { quoteId } }),
    prisma.cartItem.createMany({ data: quote.items.map((i) => ({ cartId: cart.id, variantId: i.variantId, unitCode: i.unitCode, qty: i.qty })) }),
  ]);
}

export interface CartLineDto {
  id: string;
  variantId: string;
  sku: string;
  productSlug: string;
  nameAr: string;
  nameEn: string;
  variantNameAr: string | null;
  variantNameEn: string | null;
  unitCode: string;
  unitNameAr: string;
  unitNameEn: string;
  factor: number;
  qty: number;
  qtyBase: number;
  unitPrice: number;
  unitGross: number;
  freeQtyBase: number;
  lineTotal: number;
  /** Mengenproblem (Mindestmenge/Schritt) oder nicht verfügbar */
  problem: QuantityProblem | "out_of_stock" | null;
  minQtyBase: number;
  qtyStepBase: number;
  availableBase: number;
}

export interface PricedCart {
  id: string | null;
  channel: PricingChannel;
  quoteId: string | null;
  lines: CartLineDto[];
  /** Warenwert: B2C brutto, B2B netto */
  goodsValue: number;
  net: number;
  vat: number;
  gross: number;
  count: number;
  hasProblems: boolean;
}

export async function pricedCart(owner: CartOwner): Promise<PricedCart> {
  const cart = await findCart(owner);
  const empty: PricedCart = { id: cart?.id ?? null, channel: owner.channel, quoteId: null, lines: [], goodsValue: 0, net: 0, vat: 0, gross: 0, count: 0, hasProblems: false };
  if (!cart) return empty;
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { id: "asc" },
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          nameAr: true,
          nameEn: true,
          minStock: true,
          active: true,
          product: { select: { slug: true, nameAr: true, nameEn: true, active: true, visibleB2B: true, visibleB2C: true } },
          units: { select: { factor: true, unit: { select: { code: true, nameAr: true, nameEn: true } } } },
          channelRules: { select: { channel: true, minQtyBase: true, qtyStepBase: true } },
          stockLevels: { select: { onHand: true, reserved: true } },
        },
      },
    },
  });
  const quoteId = owner.channel === "B2B" ? cart.quoteId : null;
  const reqs = items.flatMap((i) => {
    const u = i.variant.units.find((x) => x.unit.code === i.unitCode);
    return u ? [{ variantId: i.variantId, qtyBase: i.qty * u.factor }] : [];
  });
  const prices = await priceItems(reqs, { channel: owner.channel, customerId: owner.customerId }, new Date(), quoteId);
  const taxRateBps = await currentTaxRateBps(new Date());
  const lines: CartLineDto[] = [];
  for (const i of items) {
    const u = i.variant.units.find((x) => x.unit.code === i.unitCode);
    const visible = i.variant.active && i.variant.product.active && (owner.channel === "B2B" ? i.variant.product.visibleB2B : i.variant.product.visibleB2C);
    if (!u || !visible) continue;
    const qtyBase = i.qty * u.factor;
    const p = prices.get(priceKey(i.variantId, qtyBase));
    if (!p) continue;
    const rule = i.variant.channelRules.find((r) => r.channel === owner.channel) ?? { minQtyBase: 1, qtyStepBase: 1 };
    const availableBase = i.variant.stockLevels.reduce((a, s) => a + s.onHand - s.reserved, 0);
    const qtyProblem = checkQuantity(qtyBase, rule);
    const tl = lineFor(owner.channel, { unitPrice: p.unitPrice, payableQtyBase: p.payableQtyBase, taxRateBps });
    lines.push({
      id: i.id,
      variantId: i.variantId,
      sku: i.variant.sku,
      productSlug: i.variant.product.slug,
      nameAr: i.variant.product.nameAr,
      nameEn: i.variant.product.nameEn,
      variantNameAr: i.variant.nameAr,
      variantNameEn: i.variant.nameEn,
      unitCode: i.unitCode,
      unitNameAr: u.unit.nameAr,
      unitNameEn: u.unit.nameEn,
      factor: u.factor,
      qty: i.qty,
      qtyBase,
      unitPrice: p.unitPrice,
      unitGross: p.unitGross,
      freeQtyBase: p.freeQtyBase,
      lineTotal: owner.channel === "B2B" ? tl.net : tl.gross,
      problem: qtyProblem ?? (availabilityOf(i.variant) === "out" || availableBase < qtyBase ? "out_of_stock" : null),
      minQtyBase: rule.minQtyBase,
      qtyStepBase: rule.qtyStepBase,
      availableBase,
    });
  }
  const totals = computeCheckout(owner.channel, lines.map((l) => ({ unitPrice: l.unitPrice, payableQtyBase: l.qtyBase - l.freeQtyBase, taxRateBps })), null, taxRateBps);
  return {
    id: cart.id,
    channel: owner.channel,
    quoteId,
    lines,
    goodsValue: totals.goodsValue,
    net: totals.net,
    vat: totals.vat,
    gross: totals.gross,
    count: lines.length,
    hasProblems: lines.some((l) => l.problem),
  };
}

export async function cartCount(owner: CartOwner): Promise<number> {
  const cart = await findCart(owner);
  return cart ? prisma.cartItem.count({ where: { cartId: cart.id } }) : 0;
}
