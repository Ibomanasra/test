import { orderEditSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { editOrder } from "@/server/services/orders";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("order.edit");
  const input = await parseJson(req, orderEditSchema);
  await editOrder(ctx, (await params).id, input.items, input.confirmBelowMargin);
  return { ok: true };
});
