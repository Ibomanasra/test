/**
 * Generisches Dokumentmodell: Jede A4-Vorlage (Rechnung, Lieferschein, Liste …) wird
 * von der Anwendung in dieses Modell übersetzt und von `renderDocumentHtml` gesetzt.
 * Das Paket kennt keine Datenbank – Daten kommen fertig aufbereitet herein.
 */

export type DocLang = "ar" | "en" | "bi";

/** Zweisprachiger Text; `en` fehlt → `ar` wird verwendet und umgekehrt */
export interface I18nText {
  ar: string;
  en: string;
}

export type Cell = string | number | null | undefined | I18nText | { barcode: string } | { strong: string | I18nText };

export type ColumnKind = "text" | "num" | "money" | "barcode" | "check";

export interface DocColumn {
  key: string;
  label: I18nText;
  kind?: ColumnKind;
  /** CSS-Breite, z. B. "18mm" oder "30%" */
  width?: string;
}

export interface DocTableRow {
  cells: Record<string, Cell>;
  /** Zwischenüberschrift/Gruppenzeile über die volle Breite */
  group?: I18nText | string;
  muted?: boolean;
}

export interface DocTable {
  title?: I18nText;
  columns: DocColumn[];
  rows: DocTableRow[];
  /** Text, wenn keine Zeilen vorhanden */
  empty?: I18nText;
}

export interface CompanyInfo {
  nameAr: string;
  nameEn: string;
  addressAr: string;
  addressEn: string;
  phone: string;
  email?: string | null;
  website?: string | null;
  dealerNumber: string;
  taxFileNumber?: string | null;
  /** data:-URL (PNG/JPEG/SVG) */
  logoDataUrl?: string | null;
  banks: { bankNameAr: string; bankNameEn: string; branch?: string | null; accountName: string; accountNo: string; iban?: string | null; swift?: string | null }[];
}

export interface DocTotal {
  label: I18nText;
  /** Agorot */
  amount: number;
  strong?: boolean;
}

export interface DocParty {
  label: I18nText;
  lines: (string | I18nText)[];
}

export interface DocumentModel {
  /** z. B. "INVOICE" – nur für CSS-Klassen/Tests */
  kind: string;
  title: I18nText;
  number: string;
  company: CompanyInfo;
  /** Kopfangaben (Datum, Fälligkeit, Zahlungsart …) */
  meta: { label: I18nText; value: string | I18nText }[];
  parties?: DocParty[];
  /** Freitext vor den Tabellen (z. B. Mahntext) */
  intro?: (string | I18nText)[];
  tables: DocTable[];
  totals?: DocTotal[];
  /** Hinweise/Bedingungen nach den Summen */
  notes?: (string | I18nText)[];
  /** Unterschriftsfelder */
  signatures?: I18nText[];
  /** QR-Inhalt (Dokumentnummer + Link) */
  qr?: string;
  /** Stempel, z. B. „نسخة / COPY“ oder „ملغى / CANCELLED“ */
  stamp?: I18nText;
  landscape?: boolean;
  /** Fußzeile zusätzlich zu den Bankdaten */
  footerText?: I18nText;
  /** Bankdaten in der Fußzeile anzeigen (Standard: true) */
  showBanks?: boolean;
}
