import { exportQuerySchema } from "@sa/contracts";
import { businessDate } from "@sa/core";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseQuery } from "@/server/http";
import { exportRows } from "@/server/services/finance";
import { fileResponse, writeSheet } from "@/server/spreadsheet";

/** Export für den Steuerberater: ?kind=invoices|credit-notes|payments|ledger&from=&to=&format=xlsx|csv */
export const GET = apiRoute(async (req) => {
  await requireStaff("finance.export");
  const q = parseQuery(req, exportQuerySchema);
  const { columns, rows } = await exportRows(q.kind, q.from, q.to);
  const file = await writeSheet(q.format, q.kind, columns, rows);
  return fileResponse(file, `${q.kind}_${businessDate(q.from)}_${businessDate(q.to)}`);
});
