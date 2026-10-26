import { hasPermission } from "@sa/core";
import ExcelJS from "exceljs";
import { requireStaff } from "@/server/auth/context";
import { badRequest } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { applyPriceImport, diffPriceImport, parseCsv } from "@/server/services/prices-admin";

async function readRows(file: File): Promise<Record<string, string>[]> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 5 * 1024 * 1024) throw badRequest("file_too_large");
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const header: string[] = [];
    ws.getRow(1).eachCell((c, i) => (header[i] = String(c.text).trim().toLowerCase()));
    const rows: Record<string, string>[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const r: Record<string, string> = {};
      row.eachCell({ includeEmpty: true }, (c, i) => {
        if (header[i]) r[header[i]] = String(c.text ?? "").trim();
      });
      if (Object.values(r).some(Boolean)) rows.push(r);
    });
    return rows;
  }
  return parseCsv(buf.toString("utf8"));
}

/** multipart: file (.csv/.xlsx), apply ("1"), confirmBelowMargin ("1") */
export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("price.bulk", "price.edit");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("file_required");
  const rows = await readRows(file);
  if (rows.length === 0) throw badRequest("empty_file");
  if (rows.length > 20_000) throw badRequest("too_many_rows");
  const diff = await diffPriceImport(rows, hasPermission(ctx.permissions, "price.view_cost"));
  if (form.get("apply") !== "1") return { applied: false, diff };
  const res = await applyPriceImport(ctx, diff, file.name, form.get("confirmBelowMargin") === "1");
  return { applied: true, ...res, diff };
});
