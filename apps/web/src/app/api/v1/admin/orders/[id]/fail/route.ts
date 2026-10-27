import { orderFailSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { failDelivery } from "@/server/services/orders";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("order.status");
  await failDelivery(ctx, (await params).id, (await parseJson(req, orderFailSchema)).reason);
  return { ok: true };
});
