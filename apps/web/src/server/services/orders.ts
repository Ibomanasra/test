import "server-only";
import {
  assertTransition,
  businessDate,
  canPlaceOrders,
  checkQuantity,
  computeCheckout,
  deliveryDates,
  fitsCreditLimit,
  grossToNet,
  netToGross,
  hasPermission,
  isOrderEditable,
  lineFor,
  minimumPriceNet,
  type OrderStatusKey,
  type PricingChannel,
} from "@sa/core";
import { allocateDocumentNumber, prisma, type OrderStatus, type PaymentMethod, type Prisma, type Tx } from "@sa/db";
import { smsAdapter, whatsappAdapter } from "../adapters/sms";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, forbidden, notFound } from "../errors";
import { clearCart, findCart, pricedCart, type CartOwner } from "./cart";
import { archiveFiscalDocument, createCreditNote, issueInvoiceForShipment } from "./invoicing";
import { guardMargin } from "./prices-admin";
import { queueAutoPrint } from "./print-jobs";
import { currentTaxRateBps, getMinMarginBps, priceItems, priceKey } from "./pricing";
import { consumeForShipment, defaultWarehouseId, lockStock, releaseReservations, reserveStock } from "./stock";

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

function hebronHour(d = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Hebron", hour: "numeric", hourCycle: "h23" }).format(d));
}

/** Offener Saldo (Kundenjournal) + offene, noch nicht berechnete Bestellungen auf Rechnung */
export async function creditExposure(customerId: string, tx: Tx | typeof prisma = prisma) {
  const [ledger, open] = await Promise.all([
    tx.customerLedgerEntry.aggregate({ where: { customerId }, _sum: { debit: true, credit: true } }),
    tx.order.aggregate({
      where: { customerId, paymentMethod: "ON_ACCOUNT", status: { notIn: ["CANCELLED"] }, invoices: { none: {} } },
      _sum: { totalGross: true },
    }),
  ]);
  return { openBalance: (ledger._sum.debit ?? 0) - (ledger._sum.credit ?? 0), openOrders: open._sum.totalGross ?? 0 };
}

export async function checkoutOptions(ctx: AuthContext & { customer: NonNullable<AuthContext["customer"]> }) {
  const channel = ctx.channel;
  const [customer, methods] = await Promise.all([
    prisma.customer.findUniqueOrThrow({
      where: { id: ctx.customer.id },
      include: { addresses: { include: { zone: { include: { rates: { where: { channel } } } } }, orderBy: { isDefault: "desc" } } },
    }),
    prisma.paymentMethodConfig.findMany({ where: { channel, enabled: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const today = businessDate(new Date());
  const hour = hebronHour();
  const exposure = channel === "B2B" ? await creditExposure(customer.id) : null;
  return {
    channel,
    addresses: customer.addresses
      .filter((a) => a.zone.active)
      .map((a) => ({
        id: a.id,
        label: a.label,
        recipient: a.recipient,
        phone: a.phone,
        city: a.city,
        street: a.street,
        details: a.details,
        isDefault: a.isDefault,
        zone: { id: a.zone.id, nameAr: a.zone.nameAr, nameEn: a.zone.nameEn, rate: a.zone.rates[0] ?? null },
        deliveryDates: deliveryDates(today, hour, a.zone.deliveryWeekdays),
      })),
    paymentMethods: methods
      .filter((m) => m.method !== "ON_ACCOUNT" || (channel === "B2B" && customer.allowOnAccount))
      .map((m) => ({ method: m.method, labelAr: m.labelAr, labelEn: m.labelEn })),
    credit: exposure ? { limit: customer.creditLimitAgorot, ...exposure, available: customer.creditLimitAgorot - exposure.openBalance - exposure.openOrders } : null,
  };
}

export interface CheckoutInput {
  addressId: string;
  paymentMethod: PaymentMethod;
  requestedDeliveryDate: string;
  customerNote?: string;
}

async function evaluateCheckout(ctx: AuthContext & { customer: NonNullable<AuthContext["customer"]> }, input: Pick<CheckoutInput, "addressId">) {
  const owner: CartOwner = { customerId: ctx.customer.id, channel: ctx.channel };
  const cart = await pricedCart(owner);
  const address = await prisma.address.findFirst({ where: { id: input.addressId, customerId: ctx.customer.id }, include: { zone: { include: { rates: { where: { channel: ctx.channel } } } } } });
  if (!address || !address.zone.active) throw badRequest("invalid_address");
  const rate = address.zone.rates[0] ?? null;
  const taxRateBps = await currentTaxRateBps(new Date());
  const totals = computeCheckout(ctx.channel, cart.lines.map((l) => ({ unitPrice: l.unitPrice, payableQtyBase: l.qtyBase - l.freeQtyBase, taxRateBps })), rate, taxRateBps);
  return { cart, address, rate, taxRateBps, totals };
}

export async function previewCheckout(ctx: AuthContext & { customer: NonNullable<AuthContext["customer"]> }, input: Pick<CheckoutInput, "addressId">) {
  const { cart, totals } = await evaluateCheckout(ctx, input);
  return {
    lines: cart.lines,
    goodsValue: totals.goodsValue,
    deliveryFeeGross: totals.deliveryFeeGross,
    freeDelivery: totals.freeDelivery,
    minimumOrder: totals.minimumOrder,
    belowMinimum: totals.belowMinimum,
    net: totals.net,
    vat: totals.vat,
    gross: totals.gross,
    hasProblems: cart.hasProblems,
  };
}

async function notifyCustomer(orderId: string, template: "order.placed" | "order.confirmed" | "order.out_for_delivery" | "order.delivered" | "order.cancelled") {
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: { select: { phone: true, preferredLocale: true } } } });
  if (!o?.customer.phone) return;
  const ar = o.customer.preferredLocale === "ar";
  const texts: Record<typeof template, [string, string]> = {
    "order.placed": [`استلمنا طلبك ${o.number}. سنؤكده قريباً.`, `We received your order ${o.number}. We will confirm it shortly.`],
    "order.confirmed": [`تم تأكيد طلبك ${o.number}.`, `Your order ${o.number} has been confirmed.`],
    "order.out_for_delivery": [`طلبك ${o.number} في الطريق إليك.`, `Your order ${o.number} is on its way.`],
    "order.delivered": [`تم تسليم طلبك ${o.number}. شكراً لك!`, `Your order ${o.number} has been delivered. Thank you!`],
    "order.cancelled": [`تم إلغاء طلبك ${o.number}.`, `Your order ${o.number} has been cancelled.`],
  };
  const text = texts[template][ar ? 0 : 1];
  const msg = { to: o.customer.phone, template, locale: o.customer.preferredLocale, text, payload: { orderId } };
  await smsAdapter().send(msg);
  // WhatsApp-Link für den Kunden (Versand-Adapter loggt nur)
  await whatsappAdapter().send({ ...msg, payload: { orderId, link: `https://wa.me/${o.customer.phone.replace("+", "")}?text=${encodeURIComponent(text)}` } });
}

export async function placeOrder(ctx: AuthContext & { customer: NonNullable<AuthContext["customer"]> }, input: CheckoutInput) {
  if (!canPlaceOrders({ customerType: ctx.customer.type, customerStatus: ctx.customer.status })) throw forbidden("account_blocked");
  const { cart, address, totals, taxRateBps } = await evaluateCheckout(ctx, input);
  if (cart.lines.length === 0) throw badRequest("cart_empty");
  if (cart.hasProblems) throw badRequest("cart_has_problems");
  if (totals.belowMinimum) throw badRequest("below_minimum_order", { minimum: totals.minimumOrder });

  const method = await prisma.paymentMethodConfig.findUnique({ where: { method_channel: { method: input.paymentMethod, channel: ctx.channel } } });
  if (!method?.enabled) throw badRequest("payment_method_unavailable");
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: ctx.customer.id } });
  if (input.paymentMethod === "ON_ACCOUNT" && (ctx.channel !== "B2B" || !customer.allowOnAccount)) throw badRequest("payment_method_unavailable");

  const allowedDates = deliveryDates(businessDate(new Date()), hebronHour(), address.zone.deliveryWeekdays, 21);
  if (!allowedDates.includes(input.requestedDeliveryDate)) throw badRequest("invalid_delivery_date");

  const fullCart = await findCart({ customerId: ctx.customer.id, channel: ctx.channel });
  const quoteId = cart.quoteId;
  const prices = await priceItems(cart.lines.map((l) => ({ variantId: l.variantId, qtyBase: l.qtyBase })), { channel: ctx.channel, customerId: ctx.customer.id }, new Date(), quoteId);
  const variants = await prisma.productVariant.findMany({ where: { id: { in: cart.lines.map((l) => l.variantId) } }, select: { id: true, costPrice: true } });
  const minMarginBps = await getMinMarginBps();

  const order = await prisma.$transaction(
    async (tx) => {
      // Kreditlimit in der Transaktion prüfen (Kundenzeile sperren gegen parallele Bestellungen)
      await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customer.id} FOR UPDATE`;
      if (input.paymentMethod === "ON_ACCOUNT") {
        const exp = await creditExposure(customer.id, tx);
        if (!fitsCreditLimit(customer.creditLimitAgorot, exp.openBalance, exp.openOrders, totals.gross)) {
          throw new AppError(409, "credit_limit_exceeded", "credit_limit_exceeded", { available: customer.creditLimitAgorot - exp.openBalance - exp.openOrders });
        }
      }
      const { number } = await allocateDocumentNumber(tx, "ORDER");
      const costTotal = cart.lines.reduce((a, l) => a + (variants.find((v) => v.id === l.variantId)?.costPrice ?? 0) * l.qtyBase, 0);
      const created = await tx.order.create({
        data: {
          number,
          customerId: customer.id,
          channel: ctx.channel,
          placedById: ctx.user.id,
          quoteId,
          zoneId: address.zoneId,
          addressSnapshot: {
            recipient: address.recipient,
            phone: address.phone,
            city: address.city,
            street: address.street,
            details: address.details,
            label: address.label,
            zoneAr: address.zone.nameAr,
            zoneEn: address.zone.nameEn,
          },
          requestedDeliveryDate: new Date(`${input.requestedDeliveryDate}T00:00:00Z`),
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentMethod === "BANK_TRANSFER" || input.paymentMethod === "CARD_GATEWAY" ? "PENDING" : "UNPAID",
          paymentTermDays: input.paymentMethod === "ON_ACCOUNT" ? (customer.paymentTermDays ?? 0) : null,
          subtotalNet: totals.net,
          vatTotal: totals.vat,
          deliveryFeeGross: totals.deliveryFeeGross,
          totalGross: totals.gross,
          costTotal,
          taxRateBps,
          customerNote: input.customerNote,
          items: {
            create: cart.lines.map((l, idx) => {
              const p = prices.get(priceKey(l.variantId, l.qtyBase))!;
              const tl = lineFor(ctx.channel, { unitPrice: p.unitPrice, payableQtyBase: p.payableQtyBase, taxRateBps });
              const cost = variants.find((v) => v.id === l.variantId)?.costPrice ?? 0;
              return {
                variantId: l.variantId,
                skuSnapshot: l.sku,
                nameArSnapshot: [l.nameAr, l.variantNameAr].filter(Boolean).join(" – "),
                nameEnSnapshot: [l.nameEn, l.variantNameEn].filter(Boolean).join(" – "),
                unitCode: l.unitCode,
                unitFactor: l.factor,
                qty: l.qty,
                qtyBase: l.qtyBase,
                unitPriceNet: p.unitNet,
                unitPriceGross: p.unitGross,
                vatRateBps: taxRateBps,
                lineNet: tl.net,
                lineVat: tl.vat,
                lineGross: tl.gross,
                unitCost: cost,
                freeQtyBase: p.freeQtyBase,
                priceRule: p.rule,
                priceRuleRef: p.ruleRef,
                priceTrace: JSON.parse(JSON.stringify(p.trace)),
                belowMargin: p.unitNet < minimumPriceNet(cost, minMarginBps),
                sortOrder: idx,
              };
            }),
          },
          events: { create: { toStatus: "NEW", byUserId: ctx.user.id } },
        },
        include: { items: true },
      });
      await reserveStock(tx, created.items.map((i) => ({ orderItemId: i.id, variantId: i.variantId, qtyBase: i.qtyBase, sku: i.skuSnapshot })));
      if (quoteId) await tx.quote.update({ where: { id: quoteId }, data: { status: "CONVERTED" } });
      if (fullCart) {
        await tx.cartItem.deleteMany({ where: { cartId: fullCart.id } });
        await tx.cart.update({ where: { id: fullCart.id }, data: { quoteId: null } });
      }
      await audit(ctx, { action: "order.place", entityType: "Order", entityId: created.id, after: { number, totalGross: created.totalGross, items: created.items.length } }, tx);
      return created;
    },
    { timeout: 20_000 },
  );
  await notifyCustomer(order.id, "order.placed");
  return order;
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

export const ORDER_PAGE_SIZE = 25;

export interface OrderFilter {
  status?: OrderStatus;
  channel?: PricingChannel;
  q?: string;
  customerId?: string;
  from?: Date;
  to?: Date;
  page: number;
}

export async function listOrders(f: OrderFilter) {
  const where: Prisma.OrderWhereInput = {
    status: f.status,
    channel: f.channel,
    customerId: f.customerId,
    placedAt: f.from || f.to ? { gte: f.from, lt: f.to } : undefined,
    ...(f.q
      ? { OR: [{ number: { contains: f.q, mode: "insensitive" } }, { customer: { displayName: { contains: f.q, mode: "insensitive" } } }, { customer: { phone: { contains: f.q } } }] }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (f.page - 1) * ORDER_PAGE_SIZE,
      take: ORDER_PAGE_SIZE,
      include: { customer: { select: { id: true, displayName: true, number: true } }, zone: { select: { nameAr: true, nameEn: true } }, _count: { select: { items: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, pageSize: ORDER_PAGE_SIZE };
}

const orderInclude = {
  customer: { select: { id: true, number: true, displayName: true, type: true, phone: true, dealerNumber: true } },
  zone: { select: { nameAr: true, nameEn: true } },
  items: { orderBy: { sortOrder: "asc" } },
  events: { orderBy: { createdAt: "asc" }, include: { byUser: { select: { name: true } } } },
  shipments: { include: { items: true }, orderBy: { createdAt: "asc" } },
  parentOrder: { select: { id: true, number: true } },
  backorders: { select: { id: true, number: true, status: true } },
  placedBy: { select: { name: true } },
  quote: { select: { id: true, number: true } },
  invoices: { select: { id: true, number: true, totalGross: true, status: true } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export async function getOrder(id: string, customerId?: string): Promise<OrderDetail> {
  const o = await prisma.order.findFirst({ where: { id, customerId }, include: orderInclude });
  if (!o) throw notFound();
  return o;
}

// ---------------------------------------------------------------------------
// Statuswechsel (Admin)
// ---------------------------------------------------------------------------

async function recalcTotals(tx: Tx, orderId: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const lines = o.items.map((i) => {
    const effective = i.qtyBase - i.qtyCancelledBase;
    const freeShare = i.qtyBase > 0 ? Math.floor((i.freeQtyBase * effective) / i.qtyBase) : 0;
    return { unitPrice: o.channel === "B2B" ? i.unitPriceNet : i.unitPriceGross, payableQtyBase: Math.max(0, effective - freeShare), taxRateBps: i.vatRateBps };
  });
  const fee = o.deliveryFeeGross > 0 ? { feeGrossAgorot: o.deliveryFeeGross, minOrderAgorot: 0, freeFromAgorot: null } : null;
  const totals = computeCheckout(o.channel, lines, fee, o.taxRateBps);
  // Positionswerte auf die wirksame Menge (bestellt − storniert) setzen, damit Positionen und Summe übereinstimmen
  for (const [idx, item] of o.items.entries()) {
    const tl = totals.lines[idx]!;
    if (tl.net !== item.lineNet || tl.vat !== item.lineVat || tl.gross !== item.lineGross) {
      await tx.orderItem.update({ where: { id: item.id }, data: { lineNet: tl.net, lineVat: tl.vat, lineGross: tl.gross } });
    }
  }
  const costTotal = o.items.reduce((a, i) => a + i.unitCost * (i.qtyBase - i.qtyCancelledBase), 0);
  await tx.order.update({ where: { id: orderId }, data: { subtotalNet: totals.net, vatTotal: totals.vat, totalGross: totals.gross, costTotal } });
}

async function setStatus(tx: Tx, ctx: AuthContext, orderId: string, from: OrderStatus, to: OrderStatus, note?: string, extra: Prisma.OrderUpdateInput = {}) {
  assertTransition(from as OrderStatusKey, to as OrderStatusKey);
  const updated = await tx.order.updateMany({ where: { id: orderId, status: from }, data: { status: to, ...(extra as Prisma.OrderUpdateManyMutationInput) } });
  if (updated.count === 0) throw new AppError(409, "status_changed_meanwhile");
  await tx.orderStatusEvent.create({ data: { orderId, fromStatus: from, toStatus: to, byUserId: ctx.user.id, note } });
  await audit(ctx, { action: `order.status.${to.toLowerCase()}`, entityType: "Order", entityId: orderId, before: { status: from }, after: { status: to, note } }, tx);
}

/** Hook für Phase 4 (Auto-Druck) und 5 (Touren) – wird nach jedem Statuswechsel aufgerufen */
export type StatusHook = (orderId: string, status: OrderStatus, ctx: AuthContext) => Promise<void>;
const statusHooks: StatusHook[] = [];
export function onOrderStatus(hook: StatusHook) {
  statusHooks.push(hook);
}
async function runHooks(orderId: string, status: OrderStatus, ctx: AuthContext) {
  // Auto-Druck (Einstellungen → Dokumente) – Fehler blockieren den Statuswechsel nicht
  await queueAutoPrint(orderId, status, ctx).catch((err: unknown) => console.error("[auto-print]", err));
  for (const h of statusHooks) {
    try {
      await h(orderId, status, ctx);
    } catch (err) {
      console.error("[order-hook]", err);
    }
  }
}

export async function advanceOrder(ctx: AuthContext, orderId: string, to: "CONFIRMED" | "PICKING" | "READY", note?: string) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o) throw notFound();
  await prisma.$transaction(async (tx) => {
    await setStatus(tx, ctx, orderId, o.status, to, note, to === "CONFIRMED" ? { confirmedAt: new Date() } : {});
    if (to === "READY") {
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const i of items) await tx.orderItem.update({ where: { id: i.id }, data: { qtyPickedBase: i.qtyBase - i.qtyCancelledBase - i.qtyDeliveredBase } });
    }
  });
  if (to === "CONFIRMED") await notifyCustomer(orderId, "order.confirmed");
  await runHooks(orderId, to, ctx);
}

export async function cancelOrder(ctx: AuthContext, orderId: string, reason: string) {
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o) throw notFound();
  await prisma.$transaction(async (tx) => {
    await setStatus(tx, ctx, orderId, o.status, "CANCELLED", reason, { cancelledAt: new Date(), cancelReason: reason });
    await releaseReservations(tx, o.items.map((i) => i.id));
    for (const i of o.items) {
      await tx.orderItem.update({ where: { id: i.id }, data: { qtyCancelledBase: i.qtyBase - i.qtyDeliveredBase } });
    }
    if (o.quoteId) await tx.quote.updateMany({ where: { id: o.quoteId, status: "CONVERTED" }, data: { status: "ACCEPTED" } });
  });
  await notifyCustomer(orderId, "order.cancelled");
  await runHooks(orderId, "CANCELLED", ctx);
}

export interface DispatchInput {
  /** gelieferte Menge je Position (Basiseinheiten); fehlende Positionen = komplett */
  quantities?: Record<string, number>;
  remainder: "BACKORDER" | "CANCEL";
}

/** Bereit → Unterwegs: Lieferschein (DN) erzeugen, Bestand ausbuchen, Rest als Rückstand oder storniert */
export async function dispatchOrder(ctx: AuthContext, orderId: string, input: DispatchInput) {
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o) throw notFound();
  if (o.status !== "READY") throw new AppError(409, "invalid_status");
  const plan = o.items.map((i) => {
    const open = i.qtyBase - i.qtyCancelledBase - i.qtyDeliveredBase;
    const ship = Math.max(0, Math.min(open, input.quantities?.[i.id] ?? open));
    return { item: i, open, ship, rest: open - ship };
  });
  if (plan.every((p) => p.ship === 0)) throw badRequest("nothing_to_ship");

  const result = await prisma.$transaction(
    async (tx) => {
      await setStatus(tx, ctx, orderId, "READY", "OUT_FOR_DELIVERY");
      const { number } = await allocateDocumentNumber(tx, "DELIVERY_NOTE");
      const shipment = await tx.shipment.create({
        data: { number, orderId, status: "LOADED", items: { create: plan.filter((p) => p.ship > 0).map((p) => ({ orderItemId: p.item.id, qtyBase: p.ship })) } },
      });
      await consumeForShipment(tx, shipment.id, plan.filter((p) => p.ship > 0).map((p) => ({ orderItemId: p.item.id, variantId: p.item.variantId, qtyBase: p.ship, unitCost: p.item.unitCost })), ctx.user.id);
      for (const p of plan) {
        await tx.orderItem.update({ where: { id: p.item.id }, data: { qtyDeliveredBase: { increment: p.ship }, qtyPickedBase: p.ship } });
      }
      // Rechnung je Lieferschein – gleiche Transaktion → lückenlose Nummern (D23)
      const invoice = await issueInvoiceForShipment(tx, ctx, shipment.id);
      const rest = plan.filter((p) => p.rest > 0);
      let backorder: { id: string; number: string } | null = null;
      if (rest.length) {
        await releaseReservations(tx, rest.map((p) => p.item.id), new Map(rest.map((p) => [p.item.id, p.rest])));
        for (const p of rest) await tx.orderItem.update({ where: { id: p.item.id }, data: { qtyCancelledBase: { increment: p.rest } } });
        if (input.remainder === "BACKORDER") {
          const { number: boNumber } = await allocateDocumentNumber(tx, "ORDER");
          const bo = await tx.order.create({
            data: {
              number: boNumber,
              customerId: o.customerId,
              channel: o.channel,
              status: "CONFIRMED",
              placedById: ctx.user.id,
              parentOrderId: o.id,
              zoneId: o.zoneId,
              addressSnapshot: o.addressSnapshot as Prisma.InputJsonValue,
              requestedDeliveryDate: o.requestedDeliveryDate,
              paymentMethod: o.paymentMethod,
              // Vorauszahlung deckt auch den Rückstand (Karte/Überweisung bereits bezahlt)
              paymentStatus: o.paymentStatus === "PAID" ? "PAID" : "UNPAID",
              paymentTermDays: o.paymentTermDays,
              subtotalNet: 0,
              vatTotal: 0,
              totalGross: 0,
              costTotal: 0,
              taxRateBps: o.taxRateBps,
              internalNote: `Rückstand aus ${o.number}`,
              confirmedAt: new Date(),
              items: {
                create: rest.map((p, idx) => {
                  const unitFactor = p.rest % p.item.unitFactor === 0 ? p.item.unitFactor : 1;
                  return {
                    variantId: p.item.variantId,
                    skuSnapshot: p.item.skuSnapshot,
                    nameArSnapshot: p.item.nameArSnapshot,
                    nameEnSnapshot: p.item.nameEnSnapshot,
                    unitCode: unitFactor === 1 ? "PIECE" : p.item.unitCode,
                    unitFactor,
                    qty: p.rest / unitFactor,
                    qtyBase: p.rest,
                    unitPriceNet: p.item.unitPriceNet,
                    unitPriceGross: p.item.unitPriceGross,
                    vatRateBps: p.item.vatRateBps,
                    lineNet: 0,
                    lineVat: 0,
                    lineGross: 0,
                    unitCost: p.item.unitCost,
                    priceRule: p.item.priceRule,
                    priceRuleRef: p.item.priceRuleRef,
                    priceTrace: p.item.priceTrace as Prisma.InputJsonValue,
                    belowMargin: p.item.belowMargin,
                    sortOrder: idx,
                  };
                }),
              },
              events: { create: { toStatus: "CONFIRMED", byUserId: ctx.user.id, note: `Rückstand aus ${o.number}` } },
            },
            include: { items: true },
          });
          // Positionswerte nach Kanal berechnen
          for (const i of bo.items) {
            const tl = lineFor(o.channel, { unitPrice: o.channel === "B2B" ? i.unitPriceNet : i.unitPriceGross, payableQtyBase: i.qtyBase, taxRateBps: i.vatRateBps });
            await tx.orderItem.update({ where: { id: i.id }, data: { lineNet: tl.net, lineVat: tl.vat, lineGross: tl.gross } });
          }
          await recalcTotals(tx, bo.id);
          await reserveStock(tx, bo.items.map((i) => ({ orderItemId: i.id, variantId: i.variantId, qtyBase: i.qtyBase, sku: i.skuSnapshot }))).catch(async () => {
            // Ware fehlt aktuell: Rückstand bleibt ohne Reservierung bestehen (Lager sieht ihn als offen)
          });
          backorder = { id: bo.id, number: bo.number };
        }
        await recalcTotals(tx, o.id);
      }
      await audit(ctx, { action: "order.dispatch", entityType: "Order", entityId: orderId, after: { shipment: number, partial: rest.length > 0, backorder: backorder?.number } }, tx);
      return { shipment, backorder, invoice: { id: invoice.id, number: invoice.number } };
    },
    { timeout: 30_000 },
  );
  void archiveFiscalDocument("INVOICE", result.invoice.id, ctx.user.id).catch((err: unknown) => console.error("[archive]", err));
  await notifyCustomer(orderId, "order.out_for_delivery");
  await runHooks(orderId, "OUT_FOR_DELIVERY", ctx);
  return result;
}

export async function markDelivered(ctx: AuthContext, orderId: string, receivedByName?: string) {
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { shipments: true } });
  if (!o) throw notFound();
  await prisma.$transaction(async (tx) => {
    await setStatus(tx, ctx, orderId, o.status, "DELIVERED", undefined, { deliveredAt: new Date() });
    await tx.shipment.updateMany({ where: { orderId, status: { in: ["PENDING", "LOADED"] } }, data: { status: "DELIVERED", deliveredAt: new Date(), receivedByName } });
  });
  await notifyCustomer(orderId, "order.delivered");
  await runHooks(orderId, "DELIVERED", ctx);
}

/** Zustellung fehlgeschlagen: Ware zurück ins Lager und wieder reserviert, Status „Bereit“ */
export async function failDelivery(ctx: AuthContext, orderId: string, reason: string) {
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { shipments: { where: { status: { in: ["PENDING", "LOADED"] } }, include: { items: true, invoice: { select: { id: true, status: true } } } }, items: true } });
  if (!o) throw notFound();
  const creditNotes = await prisma.$transaction(async (tx) => {
    const notes: string[] = [];
    await setStatus(tx, ctx, orderId, o.status, "READY", reason);
    const warehouseId = await defaultWarehouseId(tx);
    for (const s of o.shipments) {
      await tx.shipment.update({ where: { id: s.id }, data: { status: "FAILED" } });
      await lockStock(tx, warehouseId, s.items.map((i) => o.items.find((x) => x.id === i.orderItemId)!.variantId));
      for (const si of s.items) {
        const item = o.items.find((x) => x.id === si.orderItemId)!;
        await tx.stockLevel.update({ where: { variantId_warehouseId: { variantId: item.variantId, warehouseId } }, data: { onHand: { increment: si.qtyBase }, reserved: { increment: si.qtyBase } } });
        await tx.stockMovement.create({ data: { variantId: item.variantId, warehouseId, type: "RETURN", qtyBase: si.qtyBase, unitCost: item.unitCost, refType: "Shipment", refId: s.id, note: reason, createdById: ctx.user.id } });
        await tx.stockReservation.create({ data: { orderItemId: item.id, variantId: item.variantId, qtyBase: si.qtyBase } });
        await tx.orderItem.update({ where: { id: item.id }, data: { qtyDeliveredBase: { decrement: si.qtyBase } } });
      }
      // Rechnung des fehlgeschlagenen Lieferscheins per Gutschrift stornieren (Rechnungen sind unveränderlich)
      if (s.invoice && s.invoice.status !== "CREDITED") {
        const cn = await createCreditNote(ctx, s.invoice.id, { reason: `Zustellung fehlgeschlagen: ${reason}` }, tx);
        notes.push(cn.id);
      }
    }
    return notes;
  }, { timeout: 30_000 });
  for (const id of creditNotes) void archiveFiscalDocument("CREDIT_NOTE", id, ctx.user.id).catch((err: unknown) => console.error("[archive]", err));
  await runHooks(orderId, "READY", ctx);
}

// ---------------------------------------------------------------------------
// Bearbeiten vor Bestätigung
// ---------------------------------------------------------------------------

export interface EditItemInput {
  sku: string;
  unitCode: string;
  qty: number;
  /** manueller Stückpreis (B2B netto / B2C brutto) – Recht order.edit_price */
  manualUnitPrice?: number | null;
}

export async function editOrder(ctx: AuthContext, orderId: string, items: EditItemInput[], confirmBelowMargin = false) {
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o) throw notFound();
  if (!isOrderEditable(o.status as OrderStatusKey)) throw new AppError(409, "order_not_editable");
  if (items.some((i) => i.manualUnitPrice != null) && !hasPermission(ctx.permissions, "order.edit_price")) throw forbidden("cannot_edit_price");
  if (items.length === 0) throw badRequest("cart_empty");

  const variants = await prisma.productVariant.findMany({
    where: { sku: { in: items.map((i) => i.sku) } },
    include: { product: { select: { nameAr: true, nameEn: true } }, units: { include: { unit: true } }, channelRules: true },
  });
  const resolved = items.map((i) => {
    const v = variants.find((x) => x.sku === i.sku);
    if (!v) throw badRequest("unknown_sku", { sku: i.sku });
    const u = v.units.find((x) => x.unit.code === i.unitCode);
    if (!u) throw badRequest("invalid_unit", { sku: i.sku });
    const qtyBase = i.qty * u.factor;
    const rule = v.channelRules.find((r) => r.channel === o.channel);
    const problem = rule ? checkQuantity(qtyBase, rule) : null;
    if (problem) throw badRequest(`quantity_${problem}`, { sku: i.sku });
    return { input: i, v, factor: u.factor, qtyBase };
  });
  const prices = await priceItems(resolved.map((r) => ({ variantId: r.v.id, qtyBase: r.qtyBase })), { channel: o.channel, customerId: o.customerId }, new Date(), o.quoteId);
  const minMarginBps = await getMinMarginBps();
  const taxRateBps = o.taxRateBps;

  const lines = resolved.map((r, idx) => {
    const p = prices.get(priceKey(r.v.id, r.qtyBase))!;
    const manual = r.input.manualUnitPrice != null;
    const unitPrice = manual ? r.input.manualUnitPrice! : p.unitPrice;
    const free = manual ? 0 : p.freeQtyBase;
    const tl = lineFor(o.channel, { unitPrice, payableQtyBase: r.qtyBase - free, taxRateBps });
    const unitNet = o.channel === "B2B" ? unitPrice : grossToNet(unitPrice, taxRateBps);
    const unitGross = o.channel === "B2B" ? netToGross(unitPrice, taxRateBps) : unitPrice;
    return {
      r,
      data: {
        variantId: r.v.id,
        skuSnapshot: r.v.sku,
        nameArSnapshot: [r.v.product.nameAr, r.v.nameAr].filter(Boolean).join(" – "),
        nameEnSnapshot: [r.v.product.nameEn, r.v.nameEn].filter(Boolean).join(" – "),
        unitCode: r.input.unitCode,
        unitFactor: r.factor,
        qty: r.input.qty,
        qtyBase: r.qtyBase,
        unitPriceNet: unitNet,
        unitPriceGross: unitGross,
        vatRateBps: taxRateBps,
        lineNet: tl.net,
        lineVat: tl.vat,
        lineGross: tl.gross,
        unitCost: r.v.costPrice,
        freeQtyBase: free,
        priceRule: manual ? ("MANUAL_OVERRIDE" as const) : p.rule,
        priceRuleRef: manual ? null : p.ruleRef,
        priceTrace: JSON.parse(JSON.stringify(p.trace)),
        belowMargin: unitNet < minimumPriceNet(r.v.costPrice, minMarginBps),
        overriddenById: manual ? ctx.user.id : null,
        sortOrder: idx,
      },
    };
  });
  guardMargin(
    ctx,
    lines.filter((l) => l.data.priceRule === "MANUAL_OVERRIDE" && l.data.belowMargin).map((l) => ({ sku: l.data.skuSnapshot, field: "ORDER", priceNet: l.data.unitPriceNet, minimumNet: minimumPriceNet(l.data.unitCost, minMarginBps) })),
    confirmBelowMargin,
  );

  await prisma.$transaction(
    async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: orderId } });
      if (!fresh || !isOrderEditable(fresh.status as OrderStatusKey)) throw new AppError(409, "order_not_editable");
      await releaseReservations(tx, o.items.map((i) => i.id));
      await tx.stockReservation.deleteMany({ where: { orderItemId: { in: o.items.map((i) => i.id) } } });
      await tx.orderItem.deleteMany({ where: { orderId } });
      const created = [];
      for (const l of lines) created.push(await tx.orderItem.create({ data: { ...l.data, orderId } }));
      await reserveStock(tx, created.map((i) => ({ orderItemId: i.id, variantId: i.variantId, qtyBase: i.qtyBase, sku: i.skuSnapshot })));
      await recalcTotals(tx, orderId);
      await audit(ctx, { action: "order.edit", entityType: "Order", entityId: orderId, before: o.items.map((i) => ({ sku: i.skuSnapshot, qty: i.qty, unit: i.unitCode, unitPriceNet: i.unitPriceNet })), after: lines.map((l) => ({ sku: l.data.skuSnapshot, qty: l.data.qty, unit: l.data.unitCode, unitPriceNet: l.data.unitPriceNet, rule: l.data.priceRule })) }, tx);
    },
    { timeout: 20_000 },
  );
}

// ---------------------------------------------------------------------------
// Kunde: nachbestellen, Listen, Schnellbestellung
// ---------------------------------------------------------------------------

export async function reorderToCart(owner: CartOwner, orderId: string) {
  if (!owner.customerId) throw forbidden();
  const o = await prisma.order.findFirst({ where: { id: orderId, customerId: owner.customerId }, include: { items: true } });
  if (!o) throw notFound();
  const cart = (await findCart(owner, true))!;
  for (const i of o.items) {
    await prisma.cartItem.upsert({
      where: { cartId_variantId_unitCode: { cartId: cart.id, variantId: i.variantId, unitCode: i.unitCode } },
      create: { cartId: cart.id, variantId: i.variantId, unitCode: i.unitCode, qty: i.qty },
      update: { qty: { increment: i.qty } },
    });
  }
}

export async function lastOrderId(customerId: string) {
  return (await prisma.order.findFirst({ where: { customerId }, orderBy: { placedAt: "desc" }, select: { id: true } }))?.id ?? null;
}

export { clearCart };
