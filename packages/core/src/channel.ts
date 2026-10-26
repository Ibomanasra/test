/**
 * Wirksamer Preiskanal eines Betrachters (D13).
 * B2B-Preise gibt es NUR für freigegebene Geschäftskunden – alle anderen
 * (Gäste, Privatkunden, wartende/abgelehnte/gesperrte Händler) sehen B2C.
 */

export type ChannelKey = "B2C" | "B2B";
export type CustomerTypeKey = "B2C" | "B2B";
export type CustomerStatusKey = "ACTIVE" | "PENDING_APPROVAL" | "REJECTED" | "BLOCKED";

export interface ChannelViewer {
  customerType: CustomerTypeKey;
  customerStatus: CustomerStatusKey;
}

export function effectiveChannel(viewer: ChannelViewer | null | undefined): ChannelKey {
  if (viewer && viewer.customerType === "B2B" && viewer.customerStatus === "ACTIVE") return "B2B";
  return "B2C";
}

/** Gesperrte Kunden dürfen sich anmelden und Dokumente sehen, aber nicht bestellen. */
export function canPlaceOrders(viewer: ChannelViewer | null | undefined): boolean {
  if (!viewer) return false;
  return viewer.customerStatus === "ACTIVE" || viewer.customerStatus === "PENDING_APPROVAL";
}
