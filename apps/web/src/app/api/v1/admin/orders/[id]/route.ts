import { hasPermission } from "@sa/core";
import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { getOrder } from "@/server/services/orders";

export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("order.view");
  const o = await getOrder((await params).id);
  if (hasPermission(ctx.permissions, "price.view_cost")) return o;
  const { costTotal: _c, items, ...rest } = o;
  return { ...rest, items: items.map(({ unitCost: _u, ...i }) => i) };
});
