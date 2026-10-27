import "server-only";
import { businessDate, marginBpsOf, startOfBusinessDay } from "@sa/core";
import { prisma } from "@sa/db";
import { defaultWarehouseId } from "./stock";

/**
 * Berichte (Phase 5): Umsatz = Rechnungszeilen − Gutschriftszeilen (netto), Wareneinsatz aus
 * dem Einstandspreis-Snapshot der Bestellposition. Zeitraum nach Belegdatum (Asia/Hebron).
 */

export type ReportKind = "channel" | "category" | "product" | "customer" | "zone" | "period" | "top" | "flop" | "stock-value";

interface SalesRow {
  d: Date;
  channel: "B2B" | "B2C";
  customerId: string;
  customerName: string;
  zoneAr: string | null;
  zoneEn: string | null;
  sku: string;
  nameAr: string;
  nameEn: string;
  catAr: string | null;
  catEn: string | null;
  net: number;
  qty: number;
  cost: number;
}

async function salesRows(from: Date, to: Date, channel?: "B2B" | "B2C"): Promise<SalesRow[]> {
  const rows = await prisma.$queryRaw<SalesRow[]>`
    WITH lines AS (
      SELECT i."issueDate" AS d, i.channel::text AS channel, i."customerId", i."orderId", il."orderItemId",
             il.sku, il."nameAr", il."nameEn", il."lineNet" AS net, il."qtyBase" AS qty
      FROM "InvoiceLine" il JOIN "Invoice" i ON i.id = il."invoiceId"
      WHERE i."issueDate" >= ${from} AND i."issueDate" < ${to}
      UNION ALL
      SELECT cn."issueDate", i.channel::text, cn."customerId", i."orderId", il."orderItemId",
             cl.sku, cl."nameAr", cl."nameEn", -cl."lineNet", -cl."qtyBase"
      FROM "CreditNoteLine" cl JOIN "CreditNote" cn ON cn.id = cl."creditNoteId"
      JOIN "Invoice" i ON i.id = cn."invoiceId"
      LEFT JOIN "InvoiceLine" il ON il.id = cl."invoiceLineId"
      WHERE cn."issueDate" >= ${from} AND cn."issueDate" < ${to}
    )
    SELECT l.d, l.channel, l."customerId", cu."displayName" AS "customerName",
           z."nameAr" AS "zoneAr", z."nameEn" AS "zoneEn",
           l.sku, l."nameAr", l."nameEn", c."nameAr" AS "catAr", c."nameEn" AS "catEn",
           l.net::int AS net, l.qty::int AS qty, (COALESCE(oi."unitCost", 0) * l.qty)::int AS cost
    FROM lines l
    JOIN "Customer" cu ON cu.id = l."customerId"
    LEFT JOIN "Order" o ON o.id = l."orderId"
    LEFT JOIN "DeliveryZone" z ON z.id = o."zoneId"
    LEFT JOIN "OrderItem" oi ON oi.id = l."orderItemId"
    LEFT JOIN "ProductVariant" pv ON pv.id = oi."variantId"
    LEFT JOIN "Product" p ON p.id = pv."productId"
    LEFT JOIN "Category" c ON c.id = p."categoryId"`;
  return channel ? rows.filter((r) => r.channel === channel) : rows;
}

export interface ReportRow {
  key: string;
  label: string;
  qty: number;
  net: number;
  cost: number;
  margin: number;
  marginBps: number;
  share: number;
}

export interface Report {
  kind: ReportKind;
  from: string;
  to: string;
  rows: ReportRow[];
  total: { qty: number; net: number; cost: number; margin: number; marginBps: number };
  money: boolean;
}

function group(rows: SalesRow[], keyOf: (r: SalesRow) => [string, string]): ReportRow[] {
  const map = new Map<string, ReportRow>();
  for (const r of rows) {
    const [key, label] = keyOf(r);
    const e = map.get(key) ?? { key, label, qty: 0, net: 0, cost: 0, margin: 0, marginBps: 0, share: 0 };
    e.qty += r.qty;
    e.net += r.net;
    e.cost += r.cost;
    map.set(key, e);
  }
  const total = [...map.values()].reduce((a, r) => a + r.net, 0);
  return [...map.values()].map((r) => ({ ...r, margin: r.net - r.cost, marginBps: marginBpsOf(r.net, r.cost), share: total ? Math.round((r.net * 10_000) / total) : 0 }));
}

export async function buildReport(kind: ReportKind, fromYmd: string | undefined, toYmd: string | undefined, locale: string, channel?: "B2B" | "B2C"): Promise<Report> {
  const today = businessDate(new Date());
  const from = fromYmd ?? `${today.slice(0, 7)}-01`;
  const to = toYmd ?? today;
  const ar = locale === "ar";
  if (kind === "stock-value") {
    const warehouseId = await defaultWarehouseId();
    const levels = await prisma.stockLevel.findMany({ where: { warehouseId }, include: { variant: { select: { sku: true, costPrice: true, product: { select: { nameAr: true, nameEn: true, category: { select: { nameAr: true, nameEn: true } } } } } } } });
    const rows = levels
      .map((l) => ({ key: l.variant.sku, label: `${l.variant.sku} · ${ar ? l.variant.product.nameAr : l.variant.product.nameEn}`, qty: l.onHand, net: l.onHand * l.variant.costPrice, cost: 0, margin: 0, marginBps: 0, share: 0 }))
      .sort((a, b) => b.net - a.net);
    const total = rows.reduce((a, r) => a + r.net, 0);
    for (const r of rows) r.share = total ? Math.round((r.net * 10_000) / total) : 0;
    return { kind, from, to, rows, total: { qty: rows.reduce((a, r) => a + r.qty, 0), net: total, cost: 0, margin: 0, marginBps: 0 }, money: true };
  }
  const sales = await salesRows(startOfBusinessDay(from), new Date(startOfBusinessDay(to).getTime() + 86_400_000), channel);
  const product = (r: SalesRow): [string, string] => [r.sku, r.sku === "DELIVERY" ? (ar ? "رسوم التوصيل" : "Delivery fees") : `${r.sku} · ${ar ? r.nameAr : r.nameEn}`];
  let rows: ReportRow[];
  switch (kind) {
    case "channel":
      rows = group(sales, (r) => [r.channel, r.channel]);
      break;
    case "category":
      rows = group(sales, (r) => [r.catEn ?? "-", (ar ? r.catAr : r.catEn) ?? (r.sku === "DELIVERY" ? (ar ? "رسوم التوصيل" : "Delivery fees") : "–")]);
      break;
    case "customer":
      rows = group(sales, (r) => [r.customerId, r.customerName]);
      break;
    case "zone":
      rows = group(sales, (r) => [r.zoneEn ?? "-", (ar ? r.zoneAr : r.zoneEn) ?? "–"]);
      break;
    case "period":
      rows = group(sales, (r) => {
        const m = businessDate(r.d).slice(0, 7);
        return [m, m];
      }).sort((a, b) => a.key.localeCompare(b.key));
      break;
    case "product":
    case "top":
    case "flop":
      rows = group(
        sales.filter((r) => r.sku !== "DELIVERY"),
        product,
      );
      break;
  }
  if (kind !== "period") rows.sort((a, b) => b.net - a.net);
  if (kind === "top") rows = rows.slice(0, 20);
  if (kind === "flop") {
    // Flop: auch Artikel ohne Umsatz im Zeitraum
    const sold = new Set(rows.map((r) => r.key));
    const unsold = await prisma.productVariant.findMany({ where: { active: true, sku: { notIn: [...sold] } }, select: { sku: true, product: { select: { nameAr: true, nameEn: true } } } });
    rows = [...unsold.map((v) => ({ key: v.sku, label: `${v.sku} · ${ar ? v.product.nameAr : v.product.nameEn}`, qty: 0, net: 0, cost: 0, margin: 0, marginBps: 0, share: 0 })), ...rows.reverse()].slice(0, 20);
  }
  const t = rows.reduce((a, r) => ({ qty: a.qty + r.qty, net: a.net + r.net, cost: a.cost + r.cost }), { qty: 0, net: 0, cost: 0 });
  return { kind, from, to, rows, total: { ...t, margin: t.net - t.cost, marginBps: marginBpsOf(t.net, t.cost) }, money: true };
}
