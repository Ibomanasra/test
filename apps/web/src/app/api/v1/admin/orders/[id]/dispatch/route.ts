import { orderDispatchSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { assignShipmentToDriver } from "@/server/services/delivery";
import { handOverOrder } from "@/server/services/delivery-companies";

/** Schritt 3 „Übergeben“: Lieferschein + Rechnung; an Zustellfirma oder (optional) eigenen Fahrer */
export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("order.status");
  const input = await parseJson(req, orderDispatchSchema);
  const r = await handOverOrder(ctx, (await params).id, input);
  const tour = input.driverId ? await assignShipmentToDriver(ctx, r.shipment.id, input.driverId) : null;
  return { shipment: { id: r.shipment.id, number: r.shipment.number }, invoice: r.invoice, backorder: r.backorder, company: r.company, tour };
});
