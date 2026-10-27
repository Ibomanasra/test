import { orderDeliverSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { markDelivered } from "@/server/services/orders";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("order.status");
  await markDelivered(ctx, (await params).id, (await parseJson(req, orderDeliverSchema)).receivedByName);
  return { ok: true };
});
