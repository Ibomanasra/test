import { orderOfferInputSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { deleteOrderOffer, updateOrderOffer } from "@/server/services/offers";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("price.promotions");
  return updateOrderOffer(ctx, (await params).id, await parseJson(req, orderOfferInputSchema));
});

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("price.promotions");
  return deleteOrderOffer(ctx, (await params).id);
});
