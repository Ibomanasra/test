import { supplierSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { listSuppliers, saveSupplier } from "@/server/services/inventory";

export const GET = apiRoute(async () => {
  await requireStaff("purchase.view");
  return { items: await listSuppliers() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("purchase.edit");
  return saveSupplier(ctx, null, await parseJson(req, supplierSchema));
});
