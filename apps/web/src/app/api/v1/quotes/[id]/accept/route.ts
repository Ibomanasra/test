import { requireB2BCustomer } from "@/server/auth/b2b";
import { apiRoute } from "@/server/http";
import { respondToQuote } from "@/server/services/quotes";

export const POST = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireB2BCustomer();
  return respondToQuote(ctx, ctx.customer.id, (await params).id, true);
});
