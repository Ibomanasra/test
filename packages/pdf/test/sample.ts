import type { DocumentModel } from "../src/model";

export function sampleDoc(rows = 3): DocumentModel {
  return {
    kind: "INVOICE",
    title: { ar: "فاتورة ضريبية", en: "Tax invoice" },
    number: "INV-2026-000001",
    company: {
      nameAr: "شعلة الجنوب",
      nameEn: "Sholat Aljanoub",
      addressAr: "الخليل",
      addressEn: "Hebron",
      phone: "+970 2 222 0000",
      dealerNumber: "562000000",
      banks: [{ bankNameAr: "البنك العربي", bankNameEn: "Arab Bank", accountName: "Sholat", accountNo: "123456" }],
    },
    meta: [{ label: { ar: "التاريخ", en: "Date" }, value: "2026-10-27" }],
    parties: [{ label: { ar: "العميل", en: "Customer" }, lines: ["سوبرماركت النور"] }],
    tables: [
      {
        columns: [
          { key: "name", label: { ar: "الصنف", en: "Item" } },
          { key: "qty", label: { ar: "الكمية", en: "Qty" }, kind: "num" },
          { key: "total", label: { ar: "المجموع", en: "Total" }, kind: "money" },
        ],
        rows: Array.from({ length: rows }, (_, i) => ({ cells: { name: { ar: "سائل جلي ليمون", en: "Dish soap lemon" }, qty: i + 1, total: 1290 * (i + 1) } })),
      },
    ],
    totals: [{ label: { ar: "الإجمالي", en: "Total" }, amount: 1290, strong: true }],
    qr: "INV-2026-000001",
  };
}
