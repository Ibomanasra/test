import { customerNoteSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { addCustomerNote } from "@/server/services/customers";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("customer.edit");
  const { body } = await parseJson(req, customerNoteSchema);
  return addCustomerNote(ctx, (await params).id, body);
});
