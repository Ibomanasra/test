import { orderAdvanceSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { advanceOrder } from "@/server/services/orders";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const input = await parseJson(req, orderAdvanceSchema);
  const ctx = await requireStaff(input.to === "CONFIRMED" ? "order.confirm" : "order.status");
  await advanceOrder(ctx, (await params).id, input.to, input.note);
  return { ok: true };
});
