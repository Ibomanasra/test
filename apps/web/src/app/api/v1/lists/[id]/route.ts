import { requireB2BCustomer } from "@/server/auth/b2b";
import { apiRoute } from "@/server/http";
import { deleteList } from "@/server/services/lists";

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireB2BCustomer();
  await deleteList(ctx.customer.id, (await params).id);
  return { ok: true };
});
