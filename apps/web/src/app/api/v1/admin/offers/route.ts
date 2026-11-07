import { orderOfferInputSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { createOrderOffer, listOrderOffers } from "@/server/services/offers";

export const GET = apiRoute(async () => {
  await requireStaff("price.view");
  return { items: await listOrderOffers() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("price.promotions");
  return createOrderOffer(ctx, await parseJson(req, orderOfferInputSchema));
});
