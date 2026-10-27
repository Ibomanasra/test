import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { removeProductImage } from "@/server/services/products-admin";

export const DELETE = apiRoute<{ id: string; imageId: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("product.edit");
  const { id, imageId } = await params;
  await removeProductImage(ctx, id, imageId);
  return { ok: true };
});
