import { requireStaff } from "@/server/auth/context";
import { notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { cancelStocktake, closeStocktake } from "@/server/services/inventory";

/** POST …/close | …/cancel */
export const POST = apiRoute<{ id: string; action: string }>(async (_req, { params }) => {
  const { id, action } = await params;
  const ctx = await requireStaff("stock.stocktake");
  if (action === "close") return closeStocktake(ctx, id);
  if (action === "cancel") {
    await cancelStocktake(ctx, id);
    return { ok: true };
  }
  throw notFound();
});
