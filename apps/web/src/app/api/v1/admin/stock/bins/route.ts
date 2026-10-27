import { binSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { listBins, saveBin } from "@/server/services/inventory";

export const GET = apiRoute(async () => {
  await requireStaff("stock.view");
  return { items: await listBins() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("stock.bins");
  return saveBin(ctx, null, await parseJson(req, binSchema));
});
