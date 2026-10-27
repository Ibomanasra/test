import { purchaseOrderSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { getPurchaseOrder, updatePurchaseOrder } from "@/server/services/inventory";

export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  await requireStaff("purchase.view");
  return getPurchaseOrder((await params).id);
});

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("purchase.edit");
  await updatePurchaseOrder(ctx, (await params).id, await parseJson(req, purchaseOrderSchema));
  return { ok: true };
});
