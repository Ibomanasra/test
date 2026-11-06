import { addressCreateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { deleteCustomerAddress, saveCustomerAddress } from "@/server/services/customers";

export const PUT = apiRoute<{ id: string; addressId: string }>(async (req, { params }) => {
  const ctx = await requireStaff("customer.edit");
  const { id, addressId } = await params;
  return saveCustomerAddress(ctx, id, await parseJson(req, addressCreateSchema), addressId);
});

export const DELETE = apiRoute<{ id: string; addressId: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("customer.edit");
  const { id, addressId } = await params;
  return deleteCustomerAddress(ctx, id, addressId);
});
