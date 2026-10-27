import "server-only";
import { ALL_PERMISSIONS } from "@sa/core";
import { prisma } from "@sa/db";
import { GatewayError, paymentGateway, type GatewayResult } from "../adapters/payment";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { env } from "../env";
import { AppError, badRequest, forbidden, notFound } from "../errors";
import { cancelOrder } from "./orders";

/**
 * Kartenzahlung über das Gateway (Phase 6):
 *  Bestellung (Zahlart CARD_GATEWAY, Status „Zahlung ausstehend“) → PaymentIntent →
 *  gehostete Bezahlseite → signierter Callback / Statusabfrage → Bestellung „bezahlt“.
 * Der Betrag kommt immer aus der Bestellung (Server), nie vom Client; das Gateway-Ergebnis
 * wird gegen diesen Betrag geprüft. Die Quittung entsteht mit der Rechnung beim Versand.
 */

const FINAL = new Set(["CAPTURED", "FAILED", "CANCELLED"]);

export async function startCardPayment(ctx: AuthContext, orderId: string, locale: "ar" | "en") {
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  if (!o) throw notFound();
  if (!ctx.customer || ctx.customer.id !== o.customerId) throw forbidden();
  if (o.paymentMethod !== "CARD_GATEWAY") throw badRequest("payment_method_unavailable");
  if (o.paymentStatus === "PAID") throw new AppError(409, "already_paid");
  if (o.status === "CANCELLED") throw new AppError(409, "invalid_status");
  const gw = paymentGateway();
  const intent = await prisma.paymentIntent.create({ data: { orderId, provider: gw.name, amount: o.totalGross } });
  const addr = (o.addressSnapshot ?? {}) as { city?: string; street?: string };
  try {
    const session = await gw.createSession({
      intentId: intent.id,
      amount: o.totalGross,
      currency: "ILS",
      description: o.number,
      locale,
      customer: { name: o.customer.companyName ?? o.customer.displayName, phone: o.customer.phone ?? "", email: o.customer.email, city: addr.city, street: addr.street },
      returnUrl: `${env().APP_URL}/${locale}/pay/return?intent=${intent.id}`,
      callbackUrl: `${env().APP_URL}/api/v1/payments/callback/${gw.name}`,
    });
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { providerRef: session.providerRef, status: "REDIRECTED" } });
    await audit(ctx, { action: "payment_intent.create", entityType: "PaymentIntent", entityId: intent.id, after: { order: o.number, amount: o.totalGross, provider: gw.name } });
    return { intentId: intent.id, redirectUrl: session.redirectUrl };
  } catch (err) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED", raw: { error: err instanceof Error ? err.message : String(err) } } });
    throw new AppError(502, "gateway_unavailable");
  }
}

/** Ergebnis anwenden (idempotent; Betrag muss exakt passen) */
export async function applyGatewayResult(result: GatewayResult) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PaymentIntent" WHERE id = ${result.intentId} FOR UPDATE`;
    const intent = await tx.paymentIntent.findUnique({ where: { id: result.intentId }, include: { order: { select: { id: true, number: true, totalGross: true, paymentStatus: true } } } });
    if (!intent) throw notFound();
    if (FINAL.has(intent.status) || result.status === "PENDING") return intent.status;
    let status: "CAPTURED" | "FAILED" | "CANCELLED" = result.status;
    if (status === "CAPTURED" && result.amount !== intent.amount) status = "FAILED"; // Betrag manipuliert/abweichend
    await tx.paymentIntent.update({ where: { id: intent.id }, data: { status, providerRef: result.providerRef ?? intent.providerRef, raw: JSON.parse(JSON.stringify(result.raw ?? {})) } });
    if (status === "CAPTURED") await tx.order.update({ where: { id: intent.orderId }, data: { paymentStatus: "PAID" } });
    else if (intent.order.paymentStatus === "PENDING") await tx.order.update({ where: { id: intent.orderId }, data: { paymentStatus: "UNPAID" } });
    await audit(null, { action: `payment_intent.${status.toLowerCase()}`, entityType: "PaymentIntent", entityId: intent.id, after: { order: intent.order.number, amount: result.amount, expected: intent.amount, providerRef: result.providerRef } }, tx);
    return status;
  });
}

/** Status beim Gateway nachfragen (Rückkehr des Kunden) */
export async function refreshIntent(intentId: string) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) throw notFound();
  if (FINAL.has(intent.status)) return intent.status;
  const gw = paymentGateway();
  if (gw.name !== intent.provider) return intent.status;
  try {
    return await applyGatewayResult(await gw.fetchStatus(intent.id, intent.providerRef));
  } catch (err) {
    if (err instanceof GatewayError) return intent.status;
    throw err;
  }
}

/** Server-zu-Server-Callback des Anbieters */
export async function handleCallback(provider: string, rawBody: string, headers: Headers) {
  const gw = paymentGateway();
  if (gw.name !== provider) throw notFound();
  let result: GatewayResult;
  try {
    result = await gw.verifyCallback(rawBody, headers);
  } catch (err) {
    if (err instanceof GatewayError) throw new AppError(401, "invalid_signature");
    throw err;
  }
  return applyGatewayResult(result);
}

export async function intentForViewer(ctx: AuthContext | null, intentId: string) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId }, include: { order: { select: { id: true, number: true, customerId: true, totalGross: true, paymentStatus: true } } } });
  if (!intent) throw notFound();
  if (!ctx || (ctx.customer?.id !== intent.order.customerId && !ctx.isStaff)) throw forbidden();
  return intent;
}

/** Job: Kartenbestellungen ohne Zahlung nach Ablauf stornieren (Reservierung frei) */
export async function cancelUnpaidCardOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - env().PAYMENT_TIMEOUT_MINUTES * 60_000);
  const stale = await prisma.order.findMany({ where: { paymentMethod: "CARD_GATEWAY", paymentStatus: { in: ["PENDING", "UNPAID"] }, status: "NEW", placedAt: { lt: cutoff } }, select: { id: true } });
  if (!stale.length) return 0;
  const ctx = await systemContext();
  let n = 0;
  for (const o of stale) {
    await cancelOrder(ctx, o.id, "payment timeout").then(() => n++).catch((err: unknown) => console.error("[card-timeout]", err));
  }
  return n;
}

/** Kontext für Hintergrundjobs (handelt im Namen des Inhabers, im Audit sichtbar) */
async function systemContext(): Promise<AuthContext> {
  const owner = await prisma.user.findFirstOrThrow({ where: { kind: "STAFF", roles: { some: { role: { key: "owner" } } } }, orderBy: { createdAt: "asc" } });
  return { sessionId: "system", via: "bearer", user: { id: owner.id, kind: "STAFF", name: "system", phone: owner.phone, locale: owner.locale }, permissions: new Set(ALL_PERMISSIONS), roleKeys: ["owner"], customer: null, channel: "B2C", isStaff: true };
}
