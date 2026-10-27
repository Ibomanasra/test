import { reportQuerySchema } from "@sa/contracts";
import { businessDate, formatBps } from "@sa/core";
import { renderDocumentPdf } from "@sa/pdf";
import { requireStaff } from "@/server/auth/context";
import { forbidden } from "@/server/errors";
import { apiRoute, parseQuery } from "@/server/http";
import { pdfResponse } from "@/server/pdf-response";
import { sellerSnapshot } from "@/server/services/invoicing";
import { buildReport } from "@/server/services/reports";
import { fileResponse, writeSheet } from "@/server/spreadsheet";

const TITLES: Record<string, { ar: string; en: string }> = {
  channel: { ar: "المبيعات حسب القناة", en: "Sales by channel" },
  category: { ar: "المبيعات حسب الفئة", en: "Sales by category" },
  product: { ar: "المبيعات حسب الصنف", en: "Sales by product" },
  customer: { ar: "المبيعات حسب العميل", en: "Sales by customer" },
  zone: { ar: "المبيعات حسب المنطقة", en: "Sales by zone" },
  period: { ar: "المبيعات الشهرية", en: "Sales by month" },
  top: { ar: "الأصناف الأكثر مبيعاً", en: "Top products" },
  flop: { ar: "الأصناف الأقل مبيعاً", en: "Slowest products" },
  "stock-value": { ar: "قيمة المخزون", en: "Stock value" },
};

/** Bericht als CSV/Excel/PDF (die HTML-Ansicht liegt unter /admin/reports) */
export const GET = apiRoute(async (req) => {
  const ctx = await requireStaff("report.view");
  const q = parseQuery(req, reportQuerySchema);
  if (q.format !== "html" && q.format !== "pdf" && !ctx.permissions.has("*") && !ctx.permissions.has("report.export")) throw forbidden();
  const locale = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ar";
  const r = await buildReport(q.kind, q.from ? businessDate(q.from) : undefined, q.to ? businessDate(q.to) : undefined, locale, q.channel);
  const stock = q.kind === "stock-value";
  if (q.format === "pdf") {
    const t = TITLES[q.kind]!;
    const pdf = await renderDocumentPdf(
      {
        kind: "REPORT",
        title: t,
        number: stock ? businessDate(new Date()) : `${r.from} → ${r.to}`,
        company: { ...(await sellerSnapshot()), logoDataUrl: null },
        meta: q.channel ? [{ label: { ar: "القناة", en: "Channel" }, value: q.channel }] : [],
        tables: [
          {
            columns: [
              { key: "label", label: { ar: "البند", en: "Item" } },
              { key: "qty", label: { ar: "الكمية", en: "Qty" }, kind: "num" },
              { key: "net", label: stock ? { ar: "القيمة (تكلفة)", en: "Value (cost)" } : { ar: "المبيعات (صافي)", en: "Sales (net)" }, kind: "money" },
              ...(stock ? [] : [{ key: "margin", label: { ar: "الهامش", en: "Margin" }, kind: "money" as const }, { key: "marginPct", label: { ar: "الهامش %", en: "Margin %" }, kind: "num" as const }]),
              { key: "share", label: { ar: "الحصة", en: "Share" }, kind: "num" },
            ],
            rows: r.rows.map((x) => ({ cells: { label: x.label, qty: x.qty, net: x.net, margin: x.margin, marginPct: formatBps(x.marginBps), share: formatBps(x.share) } })),
          },
        ],
        totals: [{ label: { ar: "الإجمالي", en: "Total" }, amount: r.total.net, strong: true }, ...(stock ? [] : [{ label: { ar: "الهامش", en: "Margin" }, amount: r.total.margin }])],
        showBanks: false,
      },
      locale === "en" ? "en" : "ar",
    );
    return pdfResponse(pdf, `report-${q.kind}.pdf`);
  }
  if (q.format === "html") return r;
  const file = await writeSheet(
    q.format,
    q.kind,
    [
      { key: "label", header: locale === "ar" ? "البند" : "Item", width: 40 },
      { key: "qty", header: locale === "ar" ? "الكمية" : "Qty" },
      { key: "net", header: stock ? (locale === "ar" ? "القيمة" : "Value") : locale === "ar" ? "المبيعات (صافي)" : "Sales (net)", money: true },
      { key: "cost", header: locale === "ar" ? "التكلفة" : "Cost", money: true },
      { key: "margin", header: locale === "ar" ? "الهامش" : "Margin", money: true },
      { key: "marginPct", header: "%" },
    ],
    r.rows.map((x) => ({ label: x.label, qty: x.qty, net: x.net, cost: x.cost, margin: x.margin, marginPct: formatBps(x.marginBps) })),
    locale === "ar",
  );
  return fileResponse(file, `report-${q.kind}-${r.from}-${r.to}`);
});
