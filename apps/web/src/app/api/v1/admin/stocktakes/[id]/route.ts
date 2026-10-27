import { stocktakeCountSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { getStocktake, saveStocktakeCounts } from "@/server/services/inventory";

export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  await requireStaff("stock.view");
  return getStocktake((await params).id);
});

/** Zählmengen speichern (auch mehrfach, z. B. vom Handy mit Barcode-Scanner) */
export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("stock.stocktake");
  await saveStocktakeCounts(ctx, (await params).id, await parseJson(req, stocktakeCountSchema));
  return { ok: true };
});
