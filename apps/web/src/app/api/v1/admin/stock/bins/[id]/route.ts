import { binSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { deleteBin, saveBin } from "@/server/services/inventory";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("stock.bins");
  return saveBin(ctx, (await params).id, await parseJson(req, binSchema));
});

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("stock.bins");
  await deleteBin(ctx, (await params).id);
  return { ok: true };
});
