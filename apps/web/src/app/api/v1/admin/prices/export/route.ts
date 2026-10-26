import { hasPermission } from "@sa/core";
import ExcelJS from "exceljs";
import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { PRICE_COLUMNS, exportPriceRows, toCsv } from "@/server/services/prices-admin";

export const GET = apiRoute(async (req) => {
  const ctx = await requireStaff("price.bulk");
  const includeCost = hasPermission(ctx.permissions, "price.view_cost");
  const rows = await exportPriceRows(includeCost);
  const stamp = new Date().toISOString().slice(0, 10);
  if (req.nextUrl.searchParams.get("format") === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("prices");
    ws.columns = PRICE_COLUMNS.map((key) => ({ header: key, key, width: key.startsWith("name") ? 40 : 16 }));
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true };
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="prices-${stamp}.xlsx"`,
      },
    });
  }
  return new Response(toCsv(rows, PRICE_COLUMNS), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="prices-${stamp}.csv"` },
  });
});
