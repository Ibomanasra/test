import "server-only";
import { getAuth } from "./auth/context";
import type { PricingViewer } from "./services/pricing";

/** Wirksamer Preiskanal des aktuellen Betrachters (Gast = B2C) */
export async function currentViewer(): Promise<PricingViewer> {
  const ctx = await getAuth();
  return { channel: ctx?.channel ?? "B2C", customerId: ctx?.customer?.id ?? null };
}
