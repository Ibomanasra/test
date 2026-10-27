import { orderCancelSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { cancelOrder } from "@/server/services/orders";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("order.cancel");
  await cancelOrder(ctx, (await params).id, (await parseJson(req, orderCancelSchema)).reason);
  return { ok: true };
});
