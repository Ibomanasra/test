import { purchaseOrderSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { createPurchaseOrder } from "@/server/services/inventory";

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("purchase.edit");
  const po = await createPurchaseOrder(ctx, await parseJson(req, purchaseOrderSchema));
  return { id: po.id, number: po.number };
});
