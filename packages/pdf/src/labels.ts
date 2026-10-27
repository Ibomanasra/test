import type { I18nText } from "./model";

/** Feste Beschriftungen der Vorlage (Dokument-spezifische kommen von der Anwendung) */
export const L = {
  page: { ar: "صفحة", en: "Page" },
  of: { ar: "من", en: "of" },
  dealerNo: { ar: "رقم المشتغل المرخص", en: "Licensed dealer no." },
  taxFile: { ar: "رقم الملف الضريبي", en: "Tax file no." },
  phone: { ar: "هاتف", en: "Phone" },
  bank: { ar: "البنك", en: "Bank" },
  account: { ar: "حساب", en: "Account" },
  signature: { ar: "التوقيع", en: "Signature" },
  date: { ar: "التاريخ", en: "Date" },
  name: { ar: "الاسم", en: "Name" },
  currency: { ar: "₪", en: "ILS" },
  noRows: { ar: "لا توجد بيانات", en: "No data" },
} satisfies Record<string, I18nText>;
