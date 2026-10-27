import ExcelJS from "exceljs";
import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { toCsv } from "@/server/services/prices-admin";
import { PRODUCT_COLUMNS, exportProducts } from "@/server/services/products-admin";

export const GET = apiRoute(async (req) => {
  await requireStaff("product.import");
  const rows = await exportProducts();
  const stamp = new Date().toISOString().slice(0, 10);
  if (req.nextUrl.searchParams.get("format") === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("products");
    ws.columns = PRODUCT_COLUMNS.map((key) => ({ header: key, key, width: key.startsWith("name") ? 36 : 16 }));
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true };
    return new Response(Buffer.from(await wb.xlsx.writeBuffer()), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="products-${stamp}.xlsx"` },
    });
  }
  return new Response(toCsv(rows, PRODUCT_COLUMNS), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="products-${stamp}.csv"` } });
});
