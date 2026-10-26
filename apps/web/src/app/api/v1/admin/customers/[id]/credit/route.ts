import { updateCustomerCreditSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { updateCustomerCredit } from "@/server/services/customers";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("customer.credit");
  return updateCustomerCredit(ctx, (await params).id, await parseJson(req, updateCustomerCreditSchema));
});
