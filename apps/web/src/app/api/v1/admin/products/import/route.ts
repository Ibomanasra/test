import { requireStaff } from "@/server/auth/context";
import { badRequest } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { importProducts } from "@/server/services/products-admin";
import { readSpreadsheet } from "@/server/spreadsheet";

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("product.import");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("file_required");
  const rows = await readSpreadsheet(file);
  if (rows.length === 0) throw badRequest("empty_file");
  const apply = form.get("apply") === "1";
  const result = await importProducts(ctx, rows, apply);
  return { applied: apply && !result.some((r) => r.action === "error"), rows: result };
});
