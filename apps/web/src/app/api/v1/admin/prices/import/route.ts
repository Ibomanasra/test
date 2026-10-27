import { hasPermission } from "@sa/core";
import { requireStaff } from "@/server/auth/context";
import { badRequest } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { applyPriceImport, diffPriceImport } from "@/server/services/prices-admin";
import { readSpreadsheet } from "@/server/spreadsheet";

/** multipart: file (.csv/.xlsx), apply ("1"), confirmBelowMargin ("1") */
export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("price.bulk", "price.edit");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("file_required");
  const rows = await readSpreadsheet(file);
  if (rows.length === 0) throw badRequest("empty_file");
  if (rows.length > 20_000) throw badRequest("too_many_rows");
  const diff = await diffPriceImport(rows, hasPermission(ctx.permissions, "price.view_cost"));
  if (form.get("apply") !== "1") return { applied: false, diff };
  const res = await applyPriceImport(ctx, diff, file.name, form.get("confirmBelowMargin") === "1");
  return { applied: true, ...res, diff };
});
