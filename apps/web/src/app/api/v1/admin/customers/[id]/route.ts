import { customerUpdateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { getCustomerDetail, updateCustomerMaster } from "@/server/services/customers";

export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  await requireStaff("customer.view");
  return getCustomerDetail((await params).id);
});

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("customer.edit");
  return updateCustomerMaster(ctx, (await params).id, await parseJson(req, customerUpdateSchema));
});
