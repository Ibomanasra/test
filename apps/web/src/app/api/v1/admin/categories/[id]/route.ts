import { categorySchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { deleteCategory, upsertCategory } from "@/server/services/products-admin";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("product.edit");
  return upsertCategory(ctx, (await params).id, await parseJson(req, categorySchema));
});

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("product.edit");
  await deleteCategory(ctx, (await params).id);
  return { ok: true };
});
