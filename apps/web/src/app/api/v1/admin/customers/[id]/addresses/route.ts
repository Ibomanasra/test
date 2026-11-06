import { addressCreateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { saveCustomerAddress } from "@/server/services/customers";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("customer.edit");
  return saveCustomerAddress(ctx, (await params).id, await parseJson(req, addressCreateSchema));
});
