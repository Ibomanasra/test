import "server-only";
import ExcelJS from "exceljs";
import { badRequest } from "./errors";
import { parseCsv } from "./services/prices-admin";

/** Liest .csv oder .xlsx (erstes Blatt, Kopfzeile = Spaltennamen in Kleinbuchstaben) */
export async function readSpreadsheet(file: File, maxBytes = 5 * 1024 * 1024): Promise<Record<string, string>[]> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > maxBytes) throw badRequest("file_too_large");
  if (!file.name.toLowerCase().endsWith(".xlsx")) return parseCsv(buf.toString("utf8"));
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
