import { rejectCustomerSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { rejectCustomer } from "@/server/services/customers";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("customer.approve");
  const { reason } = await parseJson(req, rejectCustomerSchema);
  return rejectCustomer(ctx, (await params).id, reason);
});
