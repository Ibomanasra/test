import { quoteRequestSchema } from "@sa/contracts";
import { requireB2BCustomer } from "@/server/auth/b2b";
import { apiRoute, parseJson } from "@/server/http";
import { listQuotes, requestQuote } from "@/server/services/quotes";

export const GET = apiRoute(async () => {
  const ctx = await requireB2BCustomer();
  return listQuotes({ customerId: ctx.customer.id, page: 1 });
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireB2BCustomer();
  return requestQuote(ctx, ctx.customer.id, await parseJson(req, quoteRequestSchema));
});
