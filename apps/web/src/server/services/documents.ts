import "server-only";
import { businessDate, formatMoney, hasPermission, type Permission } from "@sa/core";
import { prisma, type DocType } from "@sa/db";
import { mergePdfs, renderDocumentPdf, type CompanyInfo, type DocLang, type DocTable, type DocumentModel, type I18nText } from "@sa/pdf";
import { readFileBuffer } from "../adapters/storage";
import type { AuthContext } from "../auth/context";
import { env } from "../env";
import { badRequest, forbidden, notFound } from "../errors";
import { dateTimeText } from "../format";
import { customerStatement } from "./statement";
import { sellerSnapshot, type CustomerSnapshot, type SellerSnapshot } from "./invoicing";
import { priceItems, priceKey } from "./pricing";

/**
 * A4-Dokumente: übersetzt Datenbankobjekte in das generische Modell von @sa/pdf.
 * Jede Funktion liefert Modell + Zugriffsregel; die Rechte werden zentral in
 * `documentPdf` geprüft (Mitarbeiter-Recht ODER Kunde, dem der Beleg gehört).
 */

export const DOC_SLUGS = [
  "quote",
  "order-confirmation",
  "pick-list",
  "delivery-note",
  "invoice",
  "credit-note",
  "receipt",
  "tour-sheet",
  "cash-closing",
  "statement",
  "dunning",
  "purchase-order",
  "price-list",
  "stocktake",
  "stock-list",
] as const;
export type DocSlug = (typeof DOC_SLUGS)[number];

export const SLUG_DOC_TYPE: Record<DocSlug, DocType> = {
  quote: "QUOTE",
  "order-confirmation": "ORDER_CONFIRMATION",
  "pick-list": "PICK_LIST",
  "delivery-note": "DELIVERY_NOTE",
  invoice: "INVOICE",
  "credit-note": "CREDIT_NOTE",
  receipt: "RECEIPT",
  "tour-sheet": "TOUR_SHEET",
  "cash-closing": "CASH_CLOSING",
  statement: "ACCOUNT_STATEMENT",
  dunning: "DUNNING",
  "purchase-order": "PURCHASE_ORDER",
  "price-list": "PRICE_LIST",
  stocktake: "STOCKTAKE",
  "stock-list": "STOCK_LIST",
};

export const DOC_TYPE_SLUG = Object.fromEntries(Object.entries(SLUG_DOC_TYPE).map(([k, v]) => [v, k])) as Partial<Record<DocType, DocSlug>>;

export function isDocSlug(s: string): s is DocSlug {
  return (DOC_SLUGS as readonly string[]).includes(s);
}

export interface DocOptions {
  /** Lieferschein mit/ohne Preise */
  withPrices?: boolean;
  from?: string;
  to?: string;
  /** Original für das Archiv (ohne „Kopie“-Stempel) */
  original?: boolean;
}

interface Access {
  staff: Permission[];
  customerId?: string | null;
  /** zusätzlich: nur dieser Mitarbeiter (Fahrer der eigenen Tour) */
  driverId?: string | null;
}

interface Built {
  model: DocumentModel;
  access: Access;
  lang: DocLang;
}

// ---------------------------------------------------------------------------
// Beschriftungen
// ---------------------------------------------------------------------------

const t = (ar: string, en: string): I18nText => ({ ar, en });

const TITLES: Record<DocSlug, I18nText> = {
  quote: t("عرض سعر", "Quotation"),
  "order-confirmation": t("تأكيد طلب", "Order confirmation"),
  "pick-list": t("قائمة تجهيز", "Pick list"),
  "delivery-note": t("سند تسليم", "Delivery note"),
  invoice: t("فاتورة ضريبية", "Tax invoice"),
  "credit-note": t("إشعار دائن", "Credit note"),
  receipt: t("سند قبض", "Receipt"),
  "tour-sheet": t("قائمة توزيع", "Delivery tour sheet"),
  "cash-closing": t("تسوية نقدية", "Driver cash closing"),
  statement: t("كشف حساب", "Account statement"),
  dunning: t("تذكير دفع", "Payment reminder"),
  "purchase-order": t("أمر شراء", "Purchase order"),
  "price-list": t("قائمة أسعار", "Price list"),
  stocktake: t("قائمة جرد", "Stocktake count sheet"),
  "stock-list": t("قائمة المخزون", "Stock list"),
};

const L = {
  date: t("التاريخ", "Date"),
  number: t("الرقم", "Number"),
  customer: t("العميل", "Customer"),
  customerNo: t("رقم العميل", "Customer no."),
  deliveryTo: t("عنوان التسليم", "Deliver to"),
  supplier: t("المورد", "Supplier"),
  order: t("الطلب", "Order"),
  invoice: t("الفاتورة", "Invoice"),
  validUntil: t("صالح حتى", "Valid until"),
  dueDate: t("تاريخ الاستحقاق", "Due date"),
  paymentMethod: t("طريقة الدفع", "Payment method"),
  paymentTerm: t("مدة السداد", "Payment terms"),
  days: t("يوم", "days"),
  deliveryDate: t("موعد التسليم", "Delivery date"),
  dateTime: t("التاريخ والوقت", "Date / time"),
  pos: t("#", "#"),
  sku: t("الرمز", "SKU"),
  barcode: t("الباركود", "Barcode"),
  item: t("الصنف", "Item"),
  unit: t("الوحدة", "Unit"),
  qty: t("الكمية", "Qty"),
  qtyOrdered: t("المطلوب", "Ordered"),
  qtyDelivered: t("المسلَّم", "Delivered"),
  bin: t("الموقع", "Bin"),
  picked: t("تم", "Picked"),
  unitNet: t("سعر الوحدة (صافي)", "Unit price (net)"),
  unitGross: t("سعر الوحدة (شامل)", "Unit price (gross)"),
  lineNet: t("الصافي", "Net"),
  vat: t("الضريبة", "VAT"),
  lineTotal: t("المجموع", "Total"),
  subtotalNet: t("المجموع قبل الضريبة", "Subtotal (net)"),
  vatTotal: (bps: number) => t(`ضريبة القيمة المضافة ${bps / 100}%`, `VAT ${bps / 100}%`),
  vatShort: t("ضريبة القيمة المضافة", "VAT"),
  deliveryFee: t("رسوم التوصيل", "Delivery fee"),
  total: t("الإجمالي", "Total"),
  dealer: t("رقم المشتغل المرخص", "Dealer no."),
  phone: t("هاتف", "Phone"),
  signCustomer: t("توقيع المستلم (العميل)", "Received by (customer)"),
  signDriver: t("توقيع السائق", "Driver"),
  signAccountant: t("المحاسب", "Accountant"),
  signReceiver: t("المستلم", "Received by"),
  signPicker: t("المجهِّز", "Picked by"),
  signCounter: t("القائم بالجرد", "Counted by"),
  amount: t("المبلغ", "Amount"),
  reference: t("المرجع", "Reference"),
  allocatedTo: t("مخصص للفواتير", "Allocated to invoices"),
  reason: t("السبب", "Reason"),
  stop: t("التوقف", "Stop"),
  address: t("العنوان", "Address"),
  cod: t("التحصيل عند التسليم", "Cash on delivery"),
  codTotal: t("مجموع النقد المتوقع", "Expected cash total"),
  driver: t("السائق", "Driver"),
  zone: t("المنطقة", "Zone"),
  expected: t("المطلوب (حسب النظام)", "Expected"),
  counted: t("المعدود", "Counted"),
  difference: t("الفرق", "Difference"),
  type: t("النوع", "Type"),
  debit: t("مدين", "Debit"),
  credit: t("دائن", "Credit"),
  balance: t("الرصيد", "Balance"),
  opening: t("الرصيد الافتتاحي", "Opening balance"),
  closing: t("الرصيد الختامي", "Closing balance"),
  overdue: t("مستحق متأخر", "Overdue"),
  period: t("الفترة", "Period"),
  level: t("المستوى", "Level"),
  open: t("المبلغ المفتوح", "Open amount"),
  fee: t("رسوم التذكير", "Reminder fee"),
  expectedDate: t("التاريخ المتوقع", "Expected date"),
  unitCost: t("سعر الشراء (صافي)", "Unit cost (net)"),
  piecePrice: t("سعر القطعة (صافي)", "Price / piece (net)"),
  cartonPrice: t("سعر الكرتونة (صافي)", "Price / carton (net)"),
  tiers: t("أسعار الكميات", "Quantity prices"),
  group: t("الفئة", "Group"),
  onHand: t("الموجود", "On hand"),
  reserved: t("محجوز", "Reserved"),
  available: t("المتاح", "Available"),
  minStock: t("الحد الأدنى", "Min. stock"),
  warehouse: t("المستودع", "Warehouse"),
  copy: t("نسخة", "COPY"),
  cancelled: t("ملغى", "CANCELLED"),
  withoutPrices: t("بدون أسعار", "Without prices"),
  status: t("الحالة", "Status"),
  note: t("ملاحظة", "Note"),
  b2bNet: t("الأسعار بدون ضريبة القيمة المضافة", "Prices exclude VAT"),
  b2cGross: t("الأسعار شاملة ضريبة القيمة المضافة", "Prices include VAT"),
} as const;

const PAYMENT_METHOD: Record<string, I18nText> = {
  CASH_ON_DELIVERY: t("الدفع نقداً عند الاستلام", "Cash on delivery"),
  BANK_TRANSFER: t("تحويل بنكي", "Bank transfer"),
  CARD_GATEWAY: t("بطاقة ائتمان", "Card payment"),
  ON_ACCOUNT: t("على الحساب (آجل)", "On account"),
};

const LEDGER_TYPE: Record<string, I18nText> = {
  INVOICE: t("فاتورة", "Invoice"),
  CREDIT_NOTE: t("إشعار دائن", "Credit note"),
  PAYMENT: t("دفعة", "Payment"),
  REFUND: t("استرداد", "Refund"),
  DUNNING_FEE: t("رسوم تذكير", "Reminder fee"),
  OPENING_BALANCE: t("رصيد افتتاحي", "Opening balance"),
  ADJUSTMENT: t("تسوية", "Adjustment"),
};

const DUNNING_TEXT: Record<number, I18nText> = {
  1: t("نود تذكيركم بأن الفواتير التالية مستحقة الدفع. نرجو تسديدها في أقرب وقت.", "This is a friendly reminder that the following invoices are due. Please arrange payment at your earliest convenience."),
  2: t("لم نستلم حتى الآن دفعة الفواتير التالية رغم التذكير السابق. نرجو التسديد خلال 7 أيام.", "Despite our previous reminder, the following invoices remain unpaid. Please pay within 7 days."),
  3: t("تذكير أخير: في حال عدم السداد خلال 7 أيام سيتم إيقاف البيع الآجل واتخاذ الإجراءات اللازمة.", "Final reminder: if payment is not received within 7 days, credit sales will be suspended and further steps taken."),
};

const day = (d: Date | null | undefined) => (d ? businessDate(d) : "–");
const plain = (a: number) => formatMoney(a, { symbol: false });

// ---------------------------------------------------------------------------
// Gemeinsame Bausteine
// ---------------------------------------------------------------------------

let unitCache: { at: number; map: Map<string, I18nText> } | undefined;
async function unitNames(): Promise<Map<string, I18nText>> {
  if (unitCache && Date.now() - unitCache.at < 60_000) return unitCache.map;
  const units = await prisma.unitOfMeasure.findMany({ select: { code: true, nameAr: true, nameEn: true } });
  unitCache = { at: Date.now(), map: new Map(units.map((u) => [u.code, t(u.nameAr, u.nameEn)])) };
  return unitCache.map;
}

async function logoDataUrl(): Promise<string | null> {
  const c = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { logoFileId: true } });
  if (!c?.logoFileId) return null;
  try {
    const f = await readFileBuffer(c.logoFileId);
    return `data:${f.mimeType};base64,${f.data.toString("base64")}`;
  } catch {
    return null;
  }
}

async function companyInfo(snapshot?: SellerSnapshot): Promise<CompanyInfo> {
  const s = snapshot ?? (await sellerSnapshot());
  return { ...s, logoDataUrl: await logoDataUrl() };
}

async function texts(slug: DocSlug) {
  const rows = await prisma.documentTemplateText.findMany({ where: { docType: SLUG_DOC_TYPE[slug] } });
  const ar = rows.find((r) => r.locale === "ar");
  const en = rows.find((r) => r.locale === "en");
  const pick = (k: "titleText" | "headerText" | "footerText" | "termsText"): I18nText | null => {
    const a = ar?.[k]?.trim();
    const e = en?.[k]?.trim();
    return a || e ? t(a || e!, e || a!) : null;
  };
  return { title: pick("titleText"), header: pick("headerText"), footer: pick("footerText"), terms: pick("termsText") };
}

/** Vorlagentexte aus den Einstellungen anwenden (Titel, Einleitung, Bedingungen, Fußzeile) */
async function withTexts(slug: DocSlug, m: DocumentModel): Promise<DocumentModel> {
  const tx = await texts(slug);
  return {
    ...m,
    title: tx.title ?? m.title,
    intro: [...(tx.header ? [tx.header] : []), ...(m.intro ?? [])],
    notes: [...(m.notes ?? []), ...(tx.terms ? [tx.terms] : [])],
    footerText: tx.footer ?? m.footerText,
  };
}

const qr = (slug: DocSlug, id: string, number: string) => `${number}\n${env().APP_URL}/api/v1/documents/${slug}/${id}`;

function customerParty(c: CustomerSnapshot, label: I18nText = L.customer) {
  const lines: (string | I18nText)[] = [];
  lines.push(c.companyName ?? c.displayName);
  if (c.ownerName && c.ownerName !== c.companyName) lines.push(c.ownerName);
  if (c.dealerNumber) lines.push(t(`${L.dealer.ar}: ${c.dealerNumber}`, `${L.dealer.en}: ${c.dealerNumber}`));
  lines.push(t(`${L.customerNo.ar}: ${c.number}`, `${L.customerNo.en}: ${c.number}`));
  if (c.phone) lines.push(t(`${L.phone.ar}: ${c.phone}`, `${L.phone.en}: ${c.phone}`));
  return { label, lines };
}

function addressParty(a: CustomerSnapshot["address"]) {
  if (!a) return null;
  const zone = a.zoneAr || a.zoneEn ? t(a.zoneAr ?? a.zoneEn ?? "", a.zoneEn ?? a.zoneAr ?? "") : null;
  return {
    label: L.deliveryTo,
    lines: [a.recipient ?? "", [a.city, a.street, a.details].filter(Boolean).join("، "), ...(zone ? [zone] : []), ...(a.phone ? [t(`${L.phone.ar}: ${a.phone}`, `${L.phone.en}: ${a.phone}`)] : [])],
  };
}

function snapshotFromCustomer(c: { number: string; type: "B2C" | "B2B"; displayName: string; companyName: string | null; ownerName: string | null; dealerNumber: string | null; phone: string | null }, address: unknown): CustomerSnapshot {
  return { ...c, address: (address ?? null) as CustomerSnapshot["address"] };
}

const langOf = (l: string | null | undefined): DocLang => (l === "en" || l === "EN" ? "en" : l === "BILINGUAL" ? "bi" : "ar");

function taxTotals(net: number, vat: number, gross: number, rateBps: number, deliveryFeeGross = 0) {
  return [
    ...(deliveryFeeGross ? [{ label: L.deliveryFee, amount: deliveryFeeGross }] : []),
    { label: L.subtotalNet, amount: net },
    { label: rateBps ? L.vatTotal(rateBps) : L.vatShort, amount: vat },
    { label: L.total, amount: gross, strong: true },
  ];
}

/** Positionen für Angebot/Auftrag/Lieferschein mit Preisen (Kanaldarstellung) */
function salesTable(
  channel: "B2B" | "B2C",
  units: Map<string, I18nText>,
  rows: { sku: string; nameAr: string; nameEn: string; unitCode: string; unitFactor: number; qty: number; unitNet: number; unitGross: number; total: number }[],
): DocTable {
  const b2b = channel === "B2B";
  return {
    columns: [
      { key: "pos", label: L.pos, kind: "num", width: "7mm" },
      { key: "sku", label: L.sku, width: "22mm" },
      { key: "item", label: L.item },
      { key: "unit", label: L.unit, width: "20mm" },
      { key: "qty", label: L.qty, kind: "num", width: "14mm" },
      { key: "price", label: b2b ? L.unitNet : L.unitGross, kind: "money", width: "26mm" },
      { key: "total", label: b2b ? L.lineNet : L.lineTotal, kind: "money", width: "28mm" },
    ],
    rows: rows.map((r, i) => ({
      cells: {
        pos: i + 1,
        sku: r.sku,
        item: t(r.nameAr, r.nameEn),
        unit: unitLabel(units, r.unitCode, r.unitFactor),
        qty: r.qty,
        price: (b2b ? r.unitNet : r.unitGross) * r.unitFactor,
        total: r.total,
      },
    })),
  };
}

function unitLabel(units: Map<string, I18nText>, code: string, factor: number): I18nText {
  const u = units.get(code) ?? t(code, code);
  return factor > 1 ? t(`${u.ar} (${factor})`, `${u.en} (${factor})`) : u;
}

// ---------------------------------------------------------------------------
// Dokumente
// ---------------------------------------------------------------------------

async function buildQuote(id: string): Promise<Built> {
  const q = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, items: { orderBy: { sortOrder: "asc" }, include: { variant: { select: { sku: true, nameAr: true, nameEn: true, product: { select: { nameAr: true, nameEn: true } } } } } } },
  });
  if (!q) throw notFound();
  const units = await unitNames();
  const rate = q.subtotalNet ? Math.round((q.vatTotal / q.subtotalNet) * 10_000) : 1600;
  const model: DocumentModel = {
    kind: "QUOTE",
    title: TITLES.quote,
    number: q.number,
    company: await companyInfo(),
    meta: [
      { label: L.date, value: day(q.sentAt ?? q.createdAt) },
      { label: L.validUntil, value: day(q.validUntil) },
      ...(q.customer.paymentTermDays ? [{ label: L.paymentTerm, value: t(`${q.customer.paymentTermDays} ${L.days.ar}`, `${q.customer.paymentTermDays} ${L.days.en}`) }] : []),
    ],
    parties: [customerParty(snapshotFromCustomer(q.customer, null))],
    tables: [
      salesTable(
        "B2B",
        units,
        q.items.map((i) => ({
          sku: i.variant.sku,
          nameAr: [i.variant.product.nameAr, i.variant.nameAr].filter(Boolean).join(" – "),
          nameEn: [i.variant.product.nameEn, i.variant.nameEn].filter(Boolean).join(" – "),
          unitCode: i.unitCode,
          unitFactor: i.unitFactor,
          qty: i.qty,
          unitNet: i.unitPriceNet,
          unitGross: i.unitPriceNet,
          total: i.unitPriceNet * i.qty * i.unitFactor,
        })),
      ),
    ],
    totals: taxTotals(q.subtotalNet, q.vatTotal, q.totalGross, rate),
    notes: [L.b2bNet, ...(q.requestNote ? [q.requestNote] : [])],
    qr: qr("quote", q.id, q.number),
    stamp: q.status === "REJECTED" || q.status === "EXPIRED" ? t(q.status === "EXPIRED" ? "منتهي" : "مرفوض", q.status) : undefined,
  };
  return { model, access: { staff: ["quote.view"], customerId: q.status === "DRAFT" ? null : q.customerId }, lang: langOf(q.customer.preferredLocale) };
}

async function loadOrder(id: string) {
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" }, include: { variant: { select: { barcode: true, defaultBin: { select: { code: true, sortKey: true } } } } } },
    },
  });
  if (!o) throw notFound();
  return o;
}

async function buildOrderConfirmation(id: string): Promise<Built> {
  const o = await loadOrder(id);
  const units = await unitNames();
  const c = snapshotFromCustomer(o.customer, o.addressSnapshot);
  const model: DocumentModel = {
    kind: "ORDER_CONFIRMATION",
    title: TITLES["order-confirmation"],
    number: o.number,
    company: await companyInfo(),
    meta: [
      { label: L.date, value: dateTimeText(o.placedAt) },
      { label: L.deliveryDate, value: day(o.requestedDeliveryDate) },
      { label: L.paymentMethod, value: PAYMENT_METHOD[o.paymentMethod]! },
      ...(o.paymentTermDays ? [{ label: L.paymentTerm, value: t(`${o.paymentTermDays} ${L.days.ar}`, `${o.paymentTermDays} ${L.days.en}`) }] : []),
    ],
    parties: [customerParty(c), ...[addressParty(c.address)].filter((p) => p !== null)],
    tables: [
      salesTable(
        o.channel,
        units,
        o.items.map((i) => ({ sku: i.skuSnapshot, nameAr: i.nameArSnapshot, nameEn: i.nameEnSnapshot, unitCode: i.unitCode, unitFactor: i.unitFactor, qty: i.qty, unitNet: i.unitPriceNet, unitGross: i.unitPriceGross, total: o.channel === "B2B" ? i.lineNet : i.lineGross })),
      ),
    ],
    totals: taxTotals(o.subtotalNet, o.vatTotal, o.totalGross, o.taxRateBps, o.deliveryFeeGross),
    notes: [o.channel === "B2B" ? L.b2bNet : L.b2cGross, ...(o.customerNote ? [o.customerNote] : [])],
    qr: qr("order-confirmation", o.id, o.number),
    stamp: o.status === "CANCELLED" ? L.cancelled : undefined,
  };
  return { model, access: { staff: ["order.view", "order.print"], customerId: o.customerId }, lang: langOf(o.customer.preferredLocale) };
}

async function buildPickList(id: string): Promise<Built> {
  const o = await loadOrder(id);
  const units = await unitNames();
  const items = o.items
    .map((i) => ({ i, open: i.qtyBase - i.qtyCancelledBase - i.qtyDeliveredBase }))
    .filter((x) => x.open > 0)
    .sort((a, b) => (a.i.variant.defaultBin?.sortKey ?? 1e9) - (b.i.variant.defaultBin?.sortKey ?? 1e9) || a.i.skuSnapshot.localeCompare(b.i.skuSnapshot));
  const c = snapshotFromCustomer(o.customer, o.addressSnapshot);
  const model: DocumentModel = {
    kind: "PICK_LIST",
    title: TITLES["pick-list"],
    number: o.number,
    company: await companyInfo(),
    meta: [
      { label: L.date, value: dateTimeText(new Date()) },
      { label: L.deliveryDate, value: day(o.requestedDeliveryDate) },
      { label: L.customer, value: c.companyName ?? c.displayName },
    ],
    parties: [...[addressParty(c.address)].filter((p) => p !== null)],
    tables: [
      {
        columns: [
          { key: "bin", label: L.bin, width: "18mm" },
          { key: "barcode", label: L.barcode, kind: "barcode", width: "42mm" },
          { key: "item", label: L.item },
          { key: "unit", label: L.unit, width: "20mm" },
          { key: "qty", label: L.qty, kind: "num", width: "14mm" },
          { key: "check", label: L.picked, kind: "check", width: "12mm" },
        ],
        rows: items.map(({ i, open }) => {
          const whole = open % i.unitFactor === 0;
          return {
            cells: {
              bin: i.variant.defaultBin?.code ?? "–",
              barcode: { barcode: i.variant.barcode ?? i.skuSnapshot },
              item: { strong: t(`${i.skuSnapshot} · ${i.nameArSnapshot}`, `${i.skuSnapshot} · ${i.nameEnSnapshot}`) },
              unit: whole ? unitLabel(units, i.unitCode, i.unitFactor) : unitLabel(units, "PIECE", 1),
              qty: whole ? open / i.unitFactor : open,
              check: null,
            },
          };
        }),
      },
    ],
    notes: o.internalNote ? [o.internalNote] : [],
    signatures: [L.signPicker],
    qr: qr("pick-list", o.id, o.number),
    showBanks: false,
  };
  return { model, access: { staff: ["order.view", "order.print", "stock.pick"] }, lang: "ar" };
}

async function buildDeliveryNote(id: string, opts: DocOptions): Promise<Built> {
  const s = await prisma.shipment.findUnique({
    where: { id },
    include: { items: { include: { orderItem: true } }, order: { include: { customer: true } }, invoice: { select: { number: true } }, tourStop: { include: { tour: { include: { driver: { select: { name: true } } } } } } },
  });
  if (!s) throw notFound();
  const o = s.order;
  const units = await unitNames();
  const withPrices = opts.withPrices !== false;
  const items = [...s.items].sort((a, b) => a.orderItem.sortOrder - b.orderItem.sortOrder);
  const c = snapshotFromCustomer(o.customer, o.addressSnapshot);
  const rows = items.map((si) => {
    const i = si.orderItem;
    const whole = si.qtyBase % i.unitFactor === 0;
    const factor = whole ? i.unitFactor : 1;
    return { i, qty: si.qtyBase / factor, unitCode: whole ? i.unitCode : "PIECE", factor, qtyBase: si.qtyBase };
  });
  const table: DocTable = withPrices
    ? salesTable(
        o.channel,
        units,
        rows.map((r) => {
          const unit = o.channel === "B2B" ? r.i.unitPriceNet : r.i.unitPriceGross;
          return { sku: r.i.skuSnapshot, nameAr: r.i.nameArSnapshot, nameEn: r.i.nameEnSnapshot, unitCode: r.unitCode, unitFactor: r.factor, qty: r.qty, unitNet: r.i.unitPriceNet, unitGross: r.i.unitPriceGross, total: unit * r.qtyBase };
        }),
      )
    : {
        columns: [
          { key: "pos", label: L.pos, kind: "num", width: "7mm" },
          { key: "sku", label: L.sku, width: "24mm" },
          { key: "item", label: L.item },
          { key: "unit", label: L.unit, width: "24mm" },
          { key: "qty", label: L.qtyDelivered, kind: "num", width: "18mm" },
        ],
        rows: rows.map((r, idx) => ({ cells: { pos: idx + 1, sku: r.i.skuSnapshot, item: t(r.i.nameArSnapshot, r.i.nameEnSnapshot), unit: unitLabel(units, r.unitCode, r.factor), qty: r.qty } })),
      };
  const model: DocumentModel = {
    kind: "DELIVERY_NOTE",
    title: TITLES["delivery-note"],
    number: s.number,
    company: await companyInfo(),
    meta: [
      { label: L.dateTime, value: dateTimeText(s.createdAt) },
      { label: L.order, value: o.number },
      ...(s.invoice ? [{ label: L.invoice, value: s.invoice.number }] : []),
      { label: L.paymentMethod, value: PAYMENT_METHOD[o.paymentMethod]! },
      ...(s.tourStop?.tour.driver ? [{ label: L.driver, value: s.tourStop.tour.driver.name }] : []),
    ],
    parties: [customerParty(c), ...[addressParty(c.address)].filter((p) => p !== null)],
    tables: [table],
    notes: withPrices ? [o.channel === "B2B" ? L.b2bNet : L.b2cGross] : [L.withoutPrices],
    signatures: [L.signCustomer, L.signDriver],
    qr: qr("delivery-note", s.id, s.number),
    stamp: s.status === "FAILED" ? t("لم يتم التسليم", "NOT DELIVERED") : undefined,
  };
  return { model, access: { staff: ["order.view", "order.print", "delivery.driver"], customerId: o.customerId }, lang: langOf(o.customer.preferredLocale) };
}

async function buildInvoice(id: string, opts: DocOptions): Promise<Built> {
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: "asc" } }, order: { select: { number: true } }, shipment: { select: { number: true } }, creditNotes: { select: { number: true } } } });
  if (!inv) throw notFound();
  const seller = inv.sellerSnapshot as unknown as SellerSnapshot;
  const cust = inv.customerSnapshot as unknown as CustomerSnapshot;
  const units = await unitNames();
  const rate = inv.lines[0]?.vatRateBps ?? 1600;
  const term = Math.round((inv.dueDate.getTime() - inv.issueDate.getTime()) / 86_400_000);
  const extra = seller.taxInvoiceFields as { notesAr?: string; notesEn?: string };
  const model: DocumentModel = {
    kind: "INVOICE",
    title: TITLES.invoice,
    number: inv.number,
    company: await companyInfo(seller),
    meta: [
      { label: L.date, value: day(inv.issueDate) },
      { label: L.dueDate, value: day(inv.dueDate) },
      { label: L.paymentMethod, value: PAYMENT_METHOD[inv.paymentMethod]! },
      ...(term > 0 ? [{ label: L.paymentTerm, value: t(`${term} ${L.days.ar}`, `${term} ${L.days.en}`) }] : []),
      ...(inv.order ? [{ label: L.order, value: inv.order.number }] : []),
      ...(inv.shipment ? [{ label: TITLES["delivery-note"], value: inv.shipment.number }] : []),
    ],
    parties: [customerParty(cust), ...[addressParty(cust.address)].filter((p) => p !== null)],
    tables: [
      {
        columns: [
          { key: "pos", label: L.pos, kind: "num", width: "7mm" },
          { key: "sku", label: L.sku, width: "20mm" },
          { key: "item", label: L.item },
          { key: "unit", label: L.unit, width: "18mm" },
          { key: "qty", label: L.qty, kind: "num", width: "12mm" },
          { key: "price", label: L.unitNet, kind: "money", width: "22mm" },
          { key: "net", label: L.lineNet, kind: "money", width: "22mm" },
          { key: "vat", label: L.vat, kind: "money", width: "18mm" },
          { key: "gross", label: L.lineTotal, kind: "money", width: "22mm" },
        ],
        rows: inv.lines.map((l, i) => ({
          cells: { pos: i + 1, sku: l.sku === "DELIVERY" ? "" : l.sku, item: t(l.nameAr, l.nameEn), unit: unitLabel(units, l.unitCode, l.unitFactor), qty: l.qty, price: l.unitPriceNet * l.unitFactor, net: l.lineNet, vat: l.lineVat, gross: l.lineGross },
        })),
      },
    ],
    totals: taxTotals(inv.subtotalNet, inv.vatTotal, inv.totalGross, rate),
    notes: [...(extra.notesAr || extra.notesEn ? [t(extra.notesAr ?? extra.notesEn ?? "", extra.notesEn ?? extra.notesAr ?? "")] : []), ...(inv.creditNotes.length ? [t(`إشعارات دائنة: ${inv.creditNotes.map((c) => c.number).join("، ")}`, `Credit notes: ${inv.creditNotes.map((c) => c.number).join(", ")}`)] : [])],
    qr: qr("invoice", inv.id, inv.number),
    stamp: opts.original ? undefined : L.copy,
  };
  return { model, access: { staff: ["finance.view", "order.print"], customerId: inv.customerId }, lang: langOf(inv.language) };
}

async function buildCreditNote(id: string, opts: DocOptions): Promise<Built> {
  const cn = await prisma.creditNote.findUnique({ where: { id }, include: { lines: true, invoice: { select: { number: true, issueDate: true, sellerSnapshot: true } } } });
  if (!cn) throw notFound();
  const cust = cn.customerSnapshot as unknown as CustomerSnapshot;
  const rate = cn.lines[0]?.vatRateBps ?? 1600;
  const model: DocumentModel = {
    kind: "CREDIT_NOTE",
    title: TITLES["credit-note"],
    number: cn.number,
    company: await companyInfo(cn.invoice.sellerSnapshot as unknown as SellerSnapshot),
    meta: [
      { label: L.date, value: day(cn.issueDate) },
      { label: L.invoice, value: `${cn.invoice.number} (${day(cn.invoice.issueDate)})` },
    ],
    parties: [customerParty(cust)],
    intro: [t(`${L.reason.ar}: ${cn.reason}`, `${L.reason.en}: ${cn.reason}`)],
    tables: [
      {
        columns: [
          { key: "pos", label: L.pos, kind: "num", width: "7mm" },
          { key: "sku", label: L.sku, width: "22mm" },
          { key: "item", label: L.item },
          { key: "qty", label: L.qty, kind: "num", width: "14mm" },
          { key: "net", label: L.lineNet, kind: "money", width: "24mm" },
          { key: "vat", label: L.vat, kind: "money", width: "20mm" },
          { key: "gross", label: L.lineTotal, kind: "money", width: "24mm" },
        ],
        rows: cn.lines.map((l, i) => ({ cells: { pos: i + 1, sku: l.sku === "DELIVERY" ? "" : l.sku, item: t(l.nameAr, l.nameEn), qty: l.qtyBase, net: l.lineNet, vat: l.lineVat, gross: l.lineGross } })),
      },
    ],
    totals: taxTotals(cn.subtotalNet, cn.vatTotal, cn.totalGross, rate),
    qr: qr("credit-note", cn.id, cn.number),
    stamp: opts.original ? undefined : L.copy,
  };
  return { model, access: { staff: ["finance.view"], customerId: cn.customerId }, lang: langOf(cn.language) };
}

async function buildReceipt(id: string): Promise<Built> {
  const p = await prisma.payment.findUnique({ where: { id }, include: { customer: true, receivedBy: { select: { name: true } }, allocations: { include: { invoice: { select: { number: true, issueDate: true, totalGross: true } } } } } });
  if (!p) throw notFound();
  const model: DocumentModel = {
    kind: "RECEIPT",
    title: TITLES.receipt,
    number: p.number,
    company: await companyInfo(),
    meta: [
      { label: L.date, value: dateTimeText(p.receivedAt) },
      { label: L.paymentMethod, value: PAYMENT_METHOD[p.method]! },
      ...(p.reference ? [{ label: L.reference, value: p.reference }] : []),
      { label: L.amount, value: `${plain(p.amount)} ₪` },
    ],
    parties: [customerParty(snapshotFromCustomer(p.customer, null))],
    intro: [t(`استلمنا من ${p.customer.companyName ?? p.customer.displayName} مبلغ ${plain(p.amount)} شيكل.`, `Received from ${p.customer.companyName ?? p.customer.displayName} the amount of ILS ${plain(p.amount)}.`), ...(p.note ? [p.note] : [])],
    tables: [
      {
        title: L.allocatedTo,
        columns: [
          { key: "number", label: L.invoice },
          { key: "date", label: L.date, kind: "num" },
          { key: "total", label: L.total, kind: "money" },
          { key: "amount", label: L.amount, kind: "money" },
        ],
        rows: p.allocations.map((a) => ({ cells: { number: a.invoice.number, date: day(a.invoice.issueDate), total: a.invoice.totalGross, amount: a.amount } })),
        empty: t("دفعة على الحساب", "Payment on account"),
      },
    ],
    totals: [{ label: L.amount, amount: p.amount, strong: true }],
    signatures: [t(`${L.signReceiver.ar}${p.receivedBy ? `: ${p.receivedBy.name}` : ""}`, `${L.signReceiver.en}${p.receivedBy ? `: ${p.receivedBy.name}` : ""}`)],
    qr: qr("receipt", p.id, p.number),
    stamp: p.voidedAt ? L.cancelled : undefined,
  };
  return { model, access: { staff: ["finance.view", "delivery.cash_closing"], customerId: p.customerId }, lang: langOf(p.customer.preferredLocale) };
}

async function buildTourSheet(id: string): Promise<Built> {
  const tour = await prisma.tour.findUnique({
    where: { id },
    include: { zone: true, driver: { select: { id: true, name: true, phone: true } }, stops: { orderBy: { sequence: "asc" }, include: { shipment: { include: { order: { include: { customer: true } } } } } } },
  });
  if (!tour) throw notFound();
  const codTotal = tour.stops.reduce((a, s) => a + s.codExpected, 0);
  const model: DocumentModel = {
    kind: "TOUR_SHEET",
    title: TITLES["tour-sheet"],
    number: tour.number,
    company: await companyInfo(),
    landscape: true,
    meta: [
      { label: L.date, value: day(tour.date) },
      { label: L.driver, value: tour.driver ? `${tour.driver.name} · ${tour.driver.phone}` : "–" },
      ...(tour.zone ? [{ label: L.zone, value: t(tour.zone.nameAr, tour.zone.nameEn) }] : []),
    ],
    tables: [
      {
        columns: [
          { key: "seq", label: L.stop, kind: "num", width: "10mm" },
          { key: "dn", label: TITLES["delivery-note"], width: "32mm" },
          { key: "customer", label: L.customer, width: "45mm" },
          { key: "address", label: L.address },
          { key: "phone", label: L.phone, width: "30mm" },
          { key: "cod", label: L.cod, kind: "money", width: "28mm" },
          { key: "sign", label: t("التوقيع", "Signature"), width: "35mm" },
        ],
        rows: tour.stops.map((s) => {
          const a = (s.shipment.order.addressSnapshot ?? {}) as CustomerSnapshot["address"] & object;
          return {
            cells: {
              seq: s.sequence,
              dn: `${s.shipment.number}\n${s.shipment.order.number}`,
              customer: s.shipment.order.customer.companyName ?? s.shipment.order.customer.displayName,
              address: [a.city, a.street, a.details].filter(Boolean).join("، "),
              phone: a.phone ?? s.shipment.order.customer.phone ?? "",
              cod: s.codExpected || null,
              sign: "",
            },
          };
        }),
      },
    ],
    totals: [{ label: L.codTotal, amount: codTotal, strong: true }],
    signatures: [L.signDriver, t("المسؤول عن التوزيع", "Dispatcher")],
    qr: qr("tour-sheet", tour.id, tour.number),
    showBanks: false,
  };
  return { model, access: { staff: ["delivery.plan", "delivery.view_all"], driverId: tour.driverId }, lang: "ar" };
}

async function buildCashClosing(id: string): Promise<Built> {
  const cc = await prisma.cashClosing.findUnique({
    where: { id },
    include: { driver: { select: { id: true, name: true } }, collections: { orderBy: { collectedAt: "asc" }, include: { payment: { select: { number: true, customer: { select: { displayName: true, companyName: true } } } }, tourStop: { include: { shipment: { select: { number: true } } } } } } },
  });
  if (!cc) throw notFound();
  const model: DocumentModel = {
    kind: "CASH_CLOSING",
    title: TITLES["cash-closing"],
    number: cc.number,
    company: await companyInfo(),
    meta: [
      { label: L.date, value: day(cc.date) },
      { label: L.driver, value: cc.driver.name },
      { label: L.status, value: cc.status },
    ],
    tables: [
      {
        columns: [
          { key: "time", label: L.dateTime, kind: "num", width: "32mm" },
          { key: "doc", label: TITLES.receipt, width: "36mm" },
          { key: "customer", label: L.customer },
          { key: "dn", label: TITLES["delivery-note"], width: "34mm" },
          { key: "amount", label: L.amount, kind: "money", width: "26mm" },
        ],
        rows: cc.collections.map((c) => ({
          cells: { time: dateTimeText(c.collectedAt), doc: c.payment?.number ?? "", customer: c.payment ? (c.payment.customer.companyName ?? c.payment.customer.displayName) : (c.note ?? ""), dn: c.tourStop?.shipment.number ?? "", amount: c.amount },
        })),
      },
    ],
    totals: [
      { label: L.expected, amount: cc.expected },
      { label: L.counted, amount: cc.counted ?? 0 },
      { label: L.difference, amount: cc.difference ?? (cc.counted ?? 0) - cc.expected, strong: true },
    ],
    notes: cc.note ? [cc.note] : [],
    signatures: [L.signDriver, L.signAccountant],
    qr: qr("cash-closing", cc.id, cc.number),
    showBanks: false,
  };
  return { model, access: { staff: ["delivery.cash_closing"], driverId: cc.driverId }, lang: "ar" };
}

async function buildStatement(customerId: string, opts: DocOptions): Promise<Built> {
  const c = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!c) throw notFound();
  const st = await customerStatement(customerId, opts.from, opts.to);
  const model: DocumentModel = {
    kind: "ACCOUNT_STATEMENT",
    title: TITLES.statement,
    number: `ST-${c.number}-${st.to}`,
    company: await companyInfo(),
    meta: [
      { label: L.period, value: `${st.from} → ${st.to}` },
      { label: L.date, value: day(new Date()) },
      ...(c.paymentTermDays ? [{ label: L.paymentTerm, value: t(`${c.paymentTermDays} ${L.days.ar}`, `${c.paymentTermDays} ${L.days.en}`) }] : []),
    ],
    parties: [customerParty(snapshotFromCustomer(c, null))],
    tables: [
      {
        columns: [
          { key: "date", label: L.date, kind: "num", width: "22mm" },
          { key: "type", label: L.type, width: "28mm" },
          { key: "number", label: L.number, width: "36mm" },
          { key: "note", label: L.note },
          { key: "debit", label: L.debit, kind: "money", width: "24mm" },
          { key: "credit", label: L.credit, kind: "money", width: "24mm" },
          { key: "balance", label: L.balance, kind: "money", width: "26mm" },
        ],
        rows: [
          { cells: { date: st.from, type: L.opening, number: "", note: "", debit: null, credit: null, balance: st.opening }, muted: true },
          ...st.entries.map((e) => ({ cells: { date: day(e.date), type: LEDGER_TYPE[e.type] ?? e.type, number: e.refNumber ?? "", note: e.note ?? "", debit: e.debit || null, credit: e.credit || null, balance: e.balance } })),
        ],
      },
    ],
    totals: [
      { label: L.opening, amount: st.opening },
      { label: L.overdue, amount: st.overdue },
      { label: L.closing, amount: st.closing, strong: true },
    ],
    qr: qr("statement", c.id, `${c.number} ${st.from}..${st.to}`),
  };
  return { model, access: { staff: ["finance.view", "customer.view"], customerId: c.id }, lang: langOf(c.preferredLocale) };
}

async function buildDunning(id: string): Promise<Built> {
  const d = await prisma.dunningNotice.findUnique({ where: { id }, include: { customer: true, invoices: { include: { invoice: { select: { number: true, issueDate: true, dueDate: true, totalGross: true } } } } } });
  if (!d) throw notFound();
  const open = d.invoices.reduce((a, i) => a + i.openAmount, 0);
  const model: DocumentModel = {
    kind: "DUNNING",
    title: t(`${TITLES.dunning.ar} – المستوى ${d.level}`, `${TITLES.dunning.en} – level ${d.level}`),
    number: d.number,
    company: await companyInfo(),
    meta: [
      { label: L.date, value: day(d.issuedAt) },
      { label: L.level, value: String(d.level) },
      ...(d.dueBy ? [{ label: L.dueDate, value: day(d.dueBy) }] : []),
    ],
    parties: [customerParty(snapshotFromCustomer(d.customer, null))],
    intro: [DUNNING_TEXT[d.level] ?? DUNNING_TEXT[1]!],
    tables: [
      {
        columns: [
          { key: "number", label: L.invoice },
          { key: "date", label: L.date, kind: "num" },
          { key: "due", label: L.dueDate, kind: "num" },
          { key: "total", label: L.total, kind: "money" },
          { key: "open", label: L.open, kind: "money" },
        ],
        rows: d.invoices.map((i) => ({ cells: { number: i.invoice.number, date: day(i.invoice.issueDate), due: day(i.invoice.dueDate), total: i.invoice.totalGross, open: i.openAmount } })),
      },
    ],
    totals: [...(d.feeAgorot ? [{ label: L.open, amount: open }, { label: L.fee, amount: d.feeAgorot }] : []), { label: L.total, amount: open + d.feeAgorot, strong: true }],
    qr: qr("dunning", d.id, d.number),
  };
  return { model, access: { staff: ["finance.view", "finance.dunning"], customerId: d.customerId }, lang: langOf(d.customer.preferredLocale) };
}

async function buildPurchaseOrder(id: string): Promise<Built> {
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { supplier: true, items: { include: { variant: { select: { sku: true, nameAr: true, nameEn: true, product: { select: { nameAr: true, nameEn: true } } } } } } } });
  if (!po) throw notFound();
  const units = await unitNames();
  const rate = po.subtotalNet ? Math.round((po.vatTotal / po.subtotalNet) * 10_000) : 1600;
  const model: DocumentModel = {
    kind: "PURCHASE_ORDER",
    title: TITLES["purchase-order"],
    number: po.number,
    company: await companyInfo(),
    meta: [
      { label: L.date, value: day(po.orderedAt ?? po.createdAt) },
      ...(po.expectedAt ? [{ label: L.expectedDate, value: day(po.expectedAt) }] : []),
      ...(po.supplier.paymentTermDays ? [{ label: L.paymentTerm, value: t(`${po.supplier.paymentTermDays} ${L.days.ar}`, `${po.supplier.paymentTermDays} ${L.days.en}`) }] : []),
    ],
    parties: [
      {
        label: L.supplier,
        lines: [po.supplier.name, po.supplier.contactName ?? "", po.supplier.address ?? "", ...(po.supplier.phone ? [t(`${L.phone.ar}: ${po.supplier.phone}`, `${L.phone.en}: ${po.supplier.phone}`)] : []), ...(po.supplier.dealerNumber ? [t(`${L.dealer.ar}: ${po.supplier.dealerNumber}`, `${L.dealer.en}: ${po.supplier.dealerNumber}`)] : [])],
      },
    ],
    tables: [
      {
        columns: [
          { key: "pos", label: L.pos, kind: "num", width: "7mm" },
          { key: "sku", label: L.sku, width: "22mm" },
          { key: "item", label: L.item },
          { key: "unit", label: L.unit, width: "22mm" },
          { key: "qty", label: L.qty, kind: "num", width: "14mm" },
          { key: "price", label: L.unitCost, kind: "money", width: "26mm" },
          { key: "total", label: L.lineNet, kind: "money", width: "26mm" },
        ],
        rows: po.items.map((i, idx) => ({
          cells: {
            pos: idx + 1,
            sku: i.variant.sku,
            item: t([i.variant.product.nameAr, i.variant.nameAr].filter(Boolean).join(" – "), [i.variant.product.nameEn, i.variant.nameEn].filter(Boolean).join(" – ")),
            unit: unitLabel(units, i.unitCode, i.unitFactor),
            qty: i.qty,
            price: i.unitCostNet * i.unitFactor,
            total: i.unitCostNet * i.unitFactor * i.qty,
          },
        })),
      },
    ],
    totals: taxTotals(po.subtotalNet, po.vatTotal, po.totalGross, rate),
    notes: po.note ? [po.note] : [],
    signatures: [t("المشتريات", "Purchasing")],
    qr: qr("purchase-order", po.id, po.number),
    showBanks: false,
  };
  return { model, access: { staff: ["purchase.view"] }, lang: "ar" };
}

/** Preisliste: id = "customer:<id>" (persönliche Preise) oder "group:<id>" */
async function buildPriceList(id: string): Promise<Built> {
  const [kind, refId] = id.split(":");
  if (!refId || (kind !== "customer" && kind !== "group")) throw badRequest("invalid_price_list");
  const customer = kind === "customer" ? await prisma.customer.findUnique({ where: { id: refId }, include: { group: true } }) : null;
  const group = kind === "group" ? await prisma.customerGroup.findUnique({ where: { id: refId } }) : customer?.group ?? null;
  if (kind === "customer" && (!customer || customer.type !== "B2B")) throw notFound();
  if (kind === "group" && !group) throw notFound();
  const variants = await prisma.productVariant.findMany({
    where: { active: true, product: { active: true, visibleB2B: true } },
    select: {
      id: true,
      sku: true,
      nameAr: true,
      nameEn: true,
      product: { select: { nameAr: true, nameEn: true, category: { select: { nameAr: true, nameEn: true, sortOrder: true } } } },
      units: { select: { factor: true, unit: { select: { code: true } } } },
      tierPrices: { select: { minQtyBase: true }, orderBy: { minQtyBase: "asc" } },
    },
    orderBy: [{ product: { category: { sortOrder: "asc" } } }, { sku: "asc" }],
  });
  const viewer = { channel: "B2B" as const, customerId: customer?.id ?? null, groupId: kind === "group" ? refId : null };
  const reqs = variants.flatMap((v) => [{ variantId: v.id, qtyBase: 1 }, ...v.tierPrices.map((tp) => ({ variantId: v.id, qtyBase: tp.minQtyBase }))]);
  const prices = await priceItems(reqs, viewer);
  const rows: DocTable["rows"] = [];
  let lastCat = "";
  for (const v of variants) {
    const p = prices.get(priceKey(v.id, 1));
    if (!p) continue;
    const cat = v.product.category.nameAr;
    if (cat !== lastCat) {
      rows.push({ cells: {}, group: t(v.product.category.nameAr, v.product.category.nameEn) });
      lastCat = cat;
    }
    const carton = v.units.find((u) => u.unit.code === "CARTON");
    const tiers = [...new Set(v.tierPrices.map((tp) => tp.minQtyBase))]
      .map((q) => ({ q, p: prices.get(priceKey(v.id, q))?.unitPrice }))
      .filter((x) => x.p != null && x.p < p.unitPrice)
      .map((x) => `≥${x.q}: ${plain(x.p!)}`)
      .join(" · ");
    rows.push({
      cells: {
        sku: v.sku,
        item: t([v.product.nameAr, v.nameAr].filter(Boolean).join(" – "), [v.product.nameEn, v.nameEn].filter(Boolean).join(" – ")),
        piece: p.unitPrice,
        carton: carton ? p.unitPrice * carton.factor : null,
        tiers,
      },
    });
  }
  const who = customer ? (customer.companyName ?? customer.displayName) : null;
  const model: DocumentModel = {
    kind: "PRICE_LIST",
    title: TITLES["price-list"],
    number: customer ? `PRL-${customer.number}` : `PRL-${group!.code}`,
    company: await companyInfo(),
    meta: [
      { label: L.date, value: day(new Date()) },
      ...(group ? [{ label: L.group, value: t(group.nameAr, group.nameEn) }] : []),
      ...(customer?.paymentTermDays ? [{ label: L.paymentTerm, value: t(`${customer.paymentTermDays} ${L.days.ar}`, `${customer.paymentTermDays} ${L.days.en}`) }] : []),
    ],
    parties: customer ? [customerParty(snapshotFromCustomer(customer, null))] : [],
    intro: who ? [t(`أسعار خاصة بـ ${who}`, `Personal prices for ${who}`)] : [],
    tables: [
      {
        columns: [
          { key: "sku", label: L.sku, width: "22mm" },
          { key: "item", label: L.item },
          { key: "piece", label: L.piecePrice, kind: "money", width: "26mm" },
          { key: "carton", label: L.cartonPrice, kind: "money", width: "28mm" },
          { key: "tiers", label: L.tiers, kind: "num", width: "45mm" },
        ],
        rows,
      },
    ],
    notes: [L.b2bNet, t("الأسعار قابلة للتغيير دون إشعار مسبق. العروض والأسعار الخاصة حسب الاتفاق.", "Prices subject to change without notice. Promotions and special prices as agreed.")],
  };
  return { model, access: { staff: ["price.view"], customerId: customer?.status === "ACTIVE" ? customer.id : null }, lang: langOf(customer?.preferredLocale) };
}

async function buildStocktake(id: string): Promise<Built> {
  const st = await prisma.stocktake.findUnique({ where: { id }, include: { warehouse: true, lines: { include: { bin: true, variant: { select: { sku: true, barcode: true, nameAr: true, nameEn: true, product: { select: { nameAr: true, nameEn: true } } } } } } } });
  if (!st) throw notFound();
  const closed = st.status !== "OPEN";
  const lines = [...st.lines].sort((a, b) => (a.bin?.sortKey ?? 1e9) - (b.bin?.sortKey ?? 1e9) || a.variant.sku.localeCompare(b.variant.sku));
  const model: DocumentModel = {
    kind: "STOCKTAKE",
    title: TITLES.stocktake,
    number: st.number,
    company: await companyInfo(),
    meta: [
      { label: L.date, value: day(st.startedAt) },
      { label: L.warehouse, value: st.warehouse.name },
      { label: L.status, value: st.status },
    ],
    tables: [
      {
        columns: [
          { key: "bin", label: L.bin, width: "18mm" },
          { key: "barcode", label: L.barcode, kind: "barcode", width: "40mm" },
          { key: "item", label: L.item },
          ...(closed ? [{ key: "expected", label: L.expected, kind: "num" as const, width: "20mm" }] : []),
          { key: "counted", label: L.counted, kind: "num", width: "22mm" },
          ...(closed ? [{ key: "diff", label: L.difference, kind: "num" as const, width: "16mm" }] : []),
        ],
        rows: lines.map((l) => ({
          cells: {
            bin: l.bin?.code ?? "–",
            barcode: { barcode: l.variant.barcode ?? l.variant.sku },
            item: t(`${l.variant.sku} · ${[l.variant.product.nameAr, l.variant.nameAr].filter(Boolean).join(" – ")}`, `${l.variant.sku} · ${[l.variant.product.nameEn, l.variant.nameEn].filter(Boolean).join(" – ")}`),
            expected: l.expectedQty,
            counted: l.countedQty ?? (closed ? null : "______"),
            diff: l.countedQty != null ? l.countedQty - l.expectedQty : null,
          },
        })),
      },
    ],
    notes: st.note ? [st.note] : [],
    signatures: [L.signCounter, t("المراجِع", "Checked by")],
    qr: qr("stocktake", st.id, st.number),
    showBanks: false,
  };
  return { model, access: { staff: ["stock.view", "stock.stocktake"] }, lang: "ar" };
}

/** Bestandsliste: id = Lager-ID oder "all" */
async function buildStockList(id: string): Promise<Built> {
  const warehouse = id === "all" ? await prisma.warehouse.findFirst({ where: { isDefault: true } }) : await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) throw notFound();
  const levels = await prisma.stockLevel.findMany({
    where: { warehouseId: warehouse.id },
    include: { variant: { select: { sku: true, nameAr: true, nameEn: true, minStock: true, defaultBin: { select: { code: true, sortKey: true } }, product: { select: { nameAr: true, nameEn: true } } } } },
  });
  levels.sort((a, b) => (a.variant.defaultBin?.sortKey ?? 1e9) - (b.variant.defaultBin?.sortKey ?? 1e9) || a.variant.sku.localeCompare(b.variant.sku));
  const model: DocumentModel = {
    kind: "STOCK_LIST",
    title: TITLES["stock-list"],
    number: `SL-${day(new Date())}`,
    company: await companyInfo(),
    meta: [
      { label: L.dateTime, value: dateTimeText(new Date()) },
      { label: L.warehouse, value: warehouse.name },
    ],
    tables: [
      {
        columns: [
          { key: "bin", label: L.bin, width: "18mm" },
          { key: "sku", label: L.sku, width: "22mm" },
          { key: "item", label: L.item },
          { key: "onHand", label: L.onHand, kind: "num", width: "18mm" },
          { key: "reserved", label: L.reserved, kind: "num", width: "18mm" },
          { key: "available", label: L.available, kind: "num", width: "18mm" },
          { key: "min", label: L.minStock, kind: "num", width: "18mm" },
        ],
        rows: levels.map((l) => ({
          cells: {
            bin: l.variant.defaultBin?.code ?? "–",
            sku: l.variant.sku,
            item: t([l.variant.product.nameAr, l.variant.nameAr].filter(Boolean).join(" – "), [l.variant.product.nameEn, l.variant.nameEn].filter(Boolean).join(" – ")),
            onHand: l.onHand,
            reserved: l.reserved,
            available: l.onHand - l.reserved,
            min: l.variant.minStock,
          },
          muted: l.onHand === 0,
        })),
      },
    ],
    showBanks: false,
  };
  return { model, access: { staff: ["stock.view"] }, lang: "ar" };
}

async function build(slug: DocSlug, id: string, opts: DocOptions): Promise<Built> {
  let b: Built;
  switch (slug) {
    case "quote":
      b = await buildQuote(id);
      break;
    case "order-confirmation":
      b = await buildOrderConfirmation(id);
      break;
    case "pick-list":
      b = await buildPickList(id);
      break;
    case "delivery-note":
      b = await buildDeliveryNote(id, opts);
      break;
    case "invoice":
      b = await buildInvoice(id, opts);
      break;
    case "credit-note":
      b = await buildCreditNote(id, opts);
      break;
    case "receipt":
      b = await buildReceipt(id);
      break;
    case "tour-sheet":
      b = await buildTourSheet(id);
      break;
    case "cash-closing":
      b = await buildCashClosing(id);
      break;
    case "statement":
      b = await buildStatement(id, opts);
      break;
    case "dunning":
      b = await buildDunning(id);
      break;
    case "purchase-order":
      b = await buildPurchaseOrder(id);
      break;
    case "price-list":
      b = await buildPriceList(id);
      break;
    case "stocktake":
      b = await buildStocktake(id);
      break;
    case "stock-list":
      b = await buildStockList(id);
      break;
  }
  return { ...b, model: await withTexts(slug, b.model) };
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

function canAccess(ctx: AuthContext, access: Access): boolean {
  if (ctx.isStaff) {
    if (access.staff.some((p) => hasPermission(ctx.permissions, p))) return true;
    return !!access.driverId && access.driverId === ctx.user.id && hasPermission(ctx.permissions, "delivery.driver");
  }
  return !!access.customerId && ctx.customer?.id === access.customerId;
}

/** Ohne Rechteprüfung – nur für Archiv, Auto-Druck und Sammeldruck nach eigener Prüfung */
export async function renderStoredDocument(slug: DocSlug, id: string, lang: DocLang | null, opts: DocOptions = {}): Promise<Buffer> {
  const b = await build(slug, id, opts);
  return renderDocumentPdf(b.model, lang ?? b.lang);
}

export interface DocumentResult {
  pdf: Buffer;
  filename: string;
  archived: boolean;
}

/**
 * PDF für einen Betrachter. Rechnungen/Gutschriften: das eingefrorene Archiv-PDF wird
 * ausgeliefert (gleiche Sprache); andere Sprachen werden als „Kopie“ neu gesetzt.
 */
export async function documentPdf(ctx: AuthContext, slug: DocSlug, id: string, lang: DocLang | null, opts: DocOptions = {}): Promise<DocumentResult> {
  const b = await build(slug, id, { ...opts, original: false });
  if (!canAccess(ctx, b.access)) throw forbidden();
  const wanted = lang ?? b.lang;
  if (slug === "invoice" || slug === "credit-note") {
    const e = slug === "invoice" ? await prisma.invoice.findUnique({ where: { id }, select: { archivedDoc: true } }) : await prisma.creditNote.findUnique({ where: { id }, select: { archivedDoc: true } });
    const doc = e?.archivedDoc;
    if (doc && langOf(doc.language) === wanted) {
      const f = await readFileBuffer(doc.fileId);
      return { pdf: f.data, filename: `${b.model.number}.pdf`, archived: true };
    }
  }
  return { pdf: await renderDocumentPdf(b.model, wanted), filename: `${b.model.number}.pdf`, archived: false };
}

/** Sammeldruck: mehrere Dokumente (Typen × IDs) in einem PDF; jedes Dokument einzeln paginiert */
export async function batchPdf(ctx: AuthContext, items: { slug: DocSlug; id: string; opts?: DocOptions }[], lang: DocLang | null): Promise<Buffer> {
  if (items.length === 0) throw badRequest("nothing_to_print");
  if (items.length > 200) throw badRequest("too_many_documents");
  const files: Buffer[] = [];
  for (const it of items) files.push((await documentPdf(ctx, it.slug, it.id, lang, it.opts)).pdf);
  return mergePdfs(files);
}

/** Bestellung → Belege für Sammeldruck („Lieferschein + Rechnung zusammen“ usw.) */
export async function orderDocumentRefs(orderIds: string[], docs: string[]): Promise<{ slug: DocSlug; id: string; opts?: DocOptions }[]> {
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, number: true, shipments: { orderBy: { createdAt: "asc" }, select: { id: true, invoice: { select: { id: true } } } } },
  });
  const byId = new Map(orders.map((o) => [o.id, o]));
  const out: { slug: DocSlug; id: string; opts?: DocOptions }[] = [];
  for (const oid of orderIds) {
    const o = byId.get(oid);
    if (!o) continue;
    for (const d of docs) {
      if (d === "order-confirmation" || d === "pick-list") out.push({ slug: d, id: o.id });
      else if (d === "delivery-note" || d === "delivery-note-np") {
        for (const s of o.shipments) out.push({ slug: "delivery-note", id: s.id, opts: { withPrices: d === "delivery-note" } });
      } else if (d === "invoice") {
        for (const s of o.shipments) if (s.invoice) out.push({ slug: "invoice", id: s.invoice.id });
      }
    }
  }
  return out;
}
