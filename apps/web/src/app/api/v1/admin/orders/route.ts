import { orderListQuerySchema } from "@sa/contracts";
import { startOfBusinessDay } from "@sa/core";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseQuery } from "@/server/http";
import { listOrders } from "@/server/services/orders";

export const GET = apiRoute(async (req) => {
  await requireStaff("order.view");
  const f = parseQuery(req, orderListQuerySchema);
  return listOrders({ ...f, from: f.from ? startOfBusinessDay(f.from) : undefined, to: f.to ? new Date(startOfBusinessDay(f.to).getTime() + 86_400_000) : undefined });
});
