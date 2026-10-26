import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { unblockCustomer } from "@/server/services/customers";

export const POST = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("customer.block");
  return unblockCustomer(ctx, (await params).id);
});
