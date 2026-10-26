import { requireB2BCustomer } from "@/server/auth/b2b";
import { apiRoute } from "@/server/http";
import { getQuote } from "@/server/services/quotes";

export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireB2BCustomer();
  const q = await getQuote((await params).id, ctx.customer.id);
  // interne Notizen und Einkaufspreise nie an Kunden
  return {
    ...q,
    internalNote: undefined,
    createdBy: undefined,
    items: q.items.map(({ variant: { costPrice: _c, ...variant }, ...i }) => ({ ...i, variant })),
  };
});
