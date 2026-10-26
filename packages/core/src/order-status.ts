/**
 * Bestellstatus: Neu → Bestätigt → In Kommissionierung → Bereit → Unterwegs → Geliefert,
 * oder Storniert (bis einschließlich "Bereit").
 */

export const ORDER_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PICKING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatusKey = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatusKey, readonly OrderStatusKey[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PICKING", "CANCELLED"],
  PICKING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "PICKING", "CANCELLED"],
  // Fehlgeschlagene Zustellung → zurück zu "Bereit"
  OUT_FOR_DELIVERY: ["DELIVERED", "READY"],
  DELIVERED: [],
  CANCELLED: [],
};

export function allowedTransitions(from: OrderStatusKey): readonly OrderStatusKey[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatusKey, to: OrderStatusKey): boolean {
  return TRANSITIONS[from].includes(to);
}

export class OrderStatusError extends Error {
  override name = "OrderStatusError";
}

export function assertTransition(from: OrderStatusKey, to: OrderStatusKey): void {
  if (!canTransition(from, to)) {
    throw new OrderStatusError(`order status transition ${from} → ${to} is not allowed`);
  }
}

/** Positionen (Menge, Preis) sind nur vor der Bestätigung änderbar. */
export function isOrderEditable(status: OrderStatusKey): boolean {
  return status === "NEW";
}

export function isOrderFinal(status: OrderStatusKey): boolean {
  return status === "DELIVERED" || status === "CANCELLED";
}

/** Bei diesen Status ist Bestand reserviert (wird bei Stornierung freigegeben). */
export function holdsReservation(status: OrderStatusKey): boolean {
  return status === "NEW" || status === "CONFIRMED" || status === "PICKING" || status === "READY";
}

/** Reihenfolge für Fortschrittsanzeige im Shop (Storniert = -1). */
export function statusStep(status: OrderStatusKey): number {
  return status === "CANCELLED" ? -1 : ORDER_STATUSES.indexOf(status);
}
