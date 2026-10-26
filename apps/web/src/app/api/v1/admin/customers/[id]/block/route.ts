import { blockCustomerSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { blockCustomer } from "@/server/services/customers";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("customer.block");
  const { reason } = await parseJson(req, blockCustomerSchema);
  return blockCustomer(ctx, (await params).id, reason);
});
