import "server-only";
import { invoiceOpenAmount } from "@sa/core";
import { money } from "../format";
import { unassignedShipments } from "./delivery";

/** Lieferschein-Auswahl für Tourenplanung (Anzeige-Werte) */
export async function shipmentOptions(locale: string) {
  const rows = await unassignedShipments();
  return rows.map((s) => {
    const a = (s.order.addressSnapshot ?? {}) as { city?: string; street?: string; details?: string };
    return {
      id: s.id,
      number: s.number,
      order: s.order.number,
      customer: s.order.customer.displayName,
      zone: locale === "ar" ? s.order.zone.nameAr : s.order.zone.nameEn,
      address: [a.city, a.street, a.details].filter(Boolean).join("، "),
      cod: s.order.paymentMethod === "CASH_ON_DELIVERY" && s.invoice ? money(invoiceOpenAmount(s.invoice)) : "–",
    };
  });
}
