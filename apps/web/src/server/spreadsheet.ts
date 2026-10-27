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

export interface SheetColumn {
  key: string;
  header: string;
  /** Agorot → Schekel-Zahl mit 2 Nachkommastellen */
  money?: boolean;
  width?: number;
}

/** Tabelle als .xlsx (Beträge als Zahlen, RTL-Blatt für Arabisch) oder .csv (UTF-8 mit BOM) */
export async function writeSheet(format: "csv" | "xlsx", title: string, columns: SheetColumn[], rows: Record<string, string | number | null>[], rtl = false): Promise<{ data: Buffer; contentType: string; ext: string }> {
  if (format === "csv") {
    const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const cell = (c: SheetColumn, v: string | number | null) => (v == null ? "" : c.money && typeof v === "number" ? (v / 100).toFixed(2) : String(v));
    const text = "﻿" + [columns.map((c) => esc(c.header)).join(","), ...rows.map((r) => columns.map((c) => esc(cell(c, r[c.key] ?? null))).join(","))].join("\r\n") + "\r\n";
    return { data: Buffer.from(text, "utf8"), contentType: "text/csv; charset=utf-8", ext: "csv" };
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31), { views: [{ rightToLeft: rtl, state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? (c.money ? 14 : 18), style: c.money ? { numFmt: "#,##0.00" } : {} }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(Object.fromEntries(columns.map((c) => [c.key, c.money && typeof r[c.key] === "number" ? (r[c.key] as number) / 100 : r[c.key]])));
  return { data: Buffer.from(await wb.xlsx.writeBuffer()), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" };
}

export function fileResponse(file: { data: Buffer; contentType: string; ext: string }, name: string): Response {
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="${encodeURIComponent(`${name}.${file.ext}`)}"`, "X-Content-Type-Options": "nosniff" },
  });
}
