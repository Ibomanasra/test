import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { guestOrderSchema, guestPreviewSchema } from "@sa/contracts";
import { businessDate, deliveryDates } from "@sa/core";
import { nextCustomerNumber, prisma } from "@sa/db";
import type { z } from "zod";
import type { AuthContext } from "../auth/context";
import { hitRateLimit } from "../auth/rate-limit";
import { env } from "../env";
import { badRequest, conflict } from "../errors";
import { cartOwner, mergeGuestCart } from "./cart";
import { evaluateCore, hebronHour, placeOrder, previewPayload } from "./orders";
import { resolveZoneId } from "./zones";

/** Zahlungsarten für Gäste: kein „auf Rechnung“, keine Karte (die braucht ein Konto) */
export async function guestPaymentMethods() {
  const methods = await prisma.paymentMethodConfig.findMany({ where: { channel: "B2C", enabled: true }, orderBy: { sortOrder: "asc" } });
  return methods.filter((m) => m.method !== "ON_ACCOUNT" && m.method !== "CARD_GATEWAY").map((m) => ({ method: m.method, labelAr: m.labelAr, labelEn: m.labelEn }));
}

async function zoneFor(city: string, zoneId?: string) {
  const id = await resolveZoneId(city, zoneId);
  const zone = await prisma.deliveryZone.findUnique({ where: { id }, include: { rates: { where: { channel: "B2C" } } } });
  if (!zone?.active) throw badRequest("invalid_address");
  return zone;
}

/** Vorschau für Gäste: Lieferzone aus dem Ort, Liefertage, Summen (ohne Willkommens-Rabatt) */
export async function guestPreview(input: z.infer<typeof guestPreviewSchema>) {
  const zone = await zoneFor(input.city, input.zoneId);
  const core = await evaluateCore(cartOwner(null), null, "B2C", zone.rates[0] ?? null, input.couponCode, false);
  return {
    ...previewPayload(core),
    zone: { id: zone.id, nameAr: zone.nameAr, nameEn: zone.nameEn },
    deliveryDates: deliveryDates(businessDate(new Date()), hebronHour(), zone.deliveryWeekdays),
  };
}

/** Bestätigungs-Link für Gäste (ohne Login): HMAC über die Bestell-ID */
export function guestOrderToken(orderId: string) {
  return createHmac("sha256", env().SESSION_SECRET).update(`guest-order:${orderId}`).digest("base64url").slice(0, 32);
}

export function verifyGuestOrderToken(orderId: string, token: string | undefined | null) {
  if (!token) return false;
  const a = Buffer.from(guestOrderToken(orderId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Bestellung ohne Konto: Gast-Kunde (ohne Login) wird per Telefonnummer angelegt bzw. wiederverwendet,
 * dann läuft dieselbe Bestelllogik wie für Kunden (Bestand, Preise, Angebote, Benachrichtigungen).
 */
export async function placeGuestOrder(input: z.infer<typeof guestOrderSchema>, ip: string | null) {
  await hitRateLimit(`guest-order:${ip ?? "unknown"}`, 8, 3600);
  if (input.paymentMethod === "ON_ACCOUNT" || input.paymentMethod === "CARD_GATEWAY") throw badRequest("payment_method_unavailable");
  // Nummer gehört zu einem Konto → bitte anmelden (keine Bestellungen in fremden Konten)
  if (await prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } })) throw conflict("phone_registered_login");

  const zone = await zoneFor(input.city, input.zoneId);
  const existing = await prisma.customer.findFirst({ where: { phone: input.phone, type: "B2C", members: { none: {} } }, orderBy: { createdAt: "asc" } });
  const customer =
    existing ??
    (await prisma.$transaction(async (tx) =>
      tx.customer.create({ data: { number: await nextCustomerNumber(tx), type: "B2C", status: "ACTIVE", displayName: input.name, phone: input.phone, preferredLocale: input.locale } }),
    ));
  if (customer.status !== "ACTIVE") throw badRequest("account_blocked");
  const address = await prisma.address.create({
    data: { customerId: customer.id, zoneId: zone.id, recipient: input.name, phone: input.phone, city: input.city, street: input.street ?? null, details: input.details ?? null, isDefault: !existing },
  });
  // Gast-Warenkorb (Cookie) übernehmen
  await mergeGuestCart(customer.id);

  const ctx: AuthContext & { customer: NonNullable<AuthContext["customer"]> } = {
    sessionId: "guest",
    via: "cookie",
    user: { id: "", kind: "CUSTOMER", name: input.name, phone: input.phone, locale: input.locale },
    permissions: new Set<string>(),
    roleKeys: [],
    customer: { id: customer.id, number: customer.number, type: "B2C", status: "ACTIVE", displayName: customer.displayName, groupId: null, memberRole: "OWNER" },
    channel: "B2C",
    isStaff: false,
  };
  const order = await placeOrder(ctx, { addressId: address.id, paymentMethod: input.paymentMethod, requestedDeliveryDate: input.requestedDeliveryDate, customerNote: input.customerNote, couponCode: input.couponCode, guest: true });
  return { id: order.id, number: order.number, token: guestOrderToken(order.id) };
}
