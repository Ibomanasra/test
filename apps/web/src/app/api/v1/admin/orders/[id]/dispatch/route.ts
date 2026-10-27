import { orderDispatchSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { dispatchOrder } from "@/server/services/orders";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("order.status");
  const r = await dispatchOrder(ctx, (await params).id, await parseJson(req, orderDispatchSchema));
  return { shipment: { id: r.shipment.id, number: r.shipment.number }, invoice: r.invoice, backorder: r.backorder };
});
