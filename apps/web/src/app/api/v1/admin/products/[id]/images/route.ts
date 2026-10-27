import { requireStaff } from "@/server/auth/context";
import { badRequest } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { addProductImage } from "@/server/services/products-admin";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("product.edit");
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw badRequest("file_required");
  return addProductImage(ctx, (await params).id, { data: Buffer.from(await file.arrayBuffer()), name: file.name });
});
