import { stocktakeCreateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { createStocktake, listStocktakes } from "@/server/services/inventory";

export const GET = apiRoute(async () => {
  await requireStaff("stock.view");
  return { items: await listStocktakes() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("stock.stocktake");
  const st = await createStocktake(ctx, await parseJson(req, stocktakeCreateSchema));
  return { id: st.id, number: st.number };
});
