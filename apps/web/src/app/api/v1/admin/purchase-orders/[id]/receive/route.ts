import { goodsReceiptSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { receiveGoods } from "@/server/services/inventory";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("stock.receive");
  return receiveGoods(ctx, (await params).id, await parseJson(req, goodsReceiptSchema));
});
