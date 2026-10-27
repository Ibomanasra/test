import { placeOrderSchema } from "@sa/contracts";
import { requireCustomer } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { listOrders, placeOrder } from "@/server/services/orders";

export const GET = apiRoute(async (req) => {
  const ctx = await requireCustomer();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const data = await listOrders({ customerId: ctx.customer.id, page });
  return { ...data, items: data.items.map(({ costTotal: _c, internalNote: _n, ...o }) => o) };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireCustomer();
  const order = await placeOrder(ctx, await parseJson(req, placeOrderSchema));
  return { id: order.id, number: order.number, totalGross: order.totalGross };
});
