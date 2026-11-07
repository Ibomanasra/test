import { quickProductSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { badRequest } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { createQuickProduct } from "@/server/services/products-admin";

/** Produkt in einem Schritt: Formular + bis zu 8 Fotos (Feld „images“) */
export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("product.edit");
  const fd = await req.formData();
  const fields = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = quickProductSchema.safeParse(fields);
  if (!parsed.success) throw badRequest("validation_error", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 8);
  const images = await Promise.all(files.map(async (f) => ({ data: Buffer.from(await f.arrayBuffer()), name: f.name })));
  return createQuickProduct(ctx, parsed.data, images);
});
