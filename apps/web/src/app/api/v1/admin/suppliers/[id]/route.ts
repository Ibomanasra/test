import { supplierSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { saveSupplier } from "@/server/services/inventory";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("purchase.edit");
  return saveSupplier(ctx, (await params).id, await parseJson(req, supplierSchema));
});
