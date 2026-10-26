/**
 * Rechte-Schlüssel. Rollen speichern eine Liste dieser Schlüssel (Role.permissions)
 * und sind im Admin frei konfigurierbar. "*" = alle Rechte (nur Inhaber).
 *
 * Jeder API-Endpunkt und jede Server Action prüft serverseitig mit requirePermission().
 */

export const PERMISSIONS = {
  // Dashboard
  "dashboard.view": "Dashboard ansehen",
  "dashboard.view_margin": "Margen im Dashboard sehen",
  // Produkte
  "product.view": "Produkte ansehen",
  "product.edit": "Produkte anlegen/bearbeiten",
  "product.import": "Produkte importieren/exportieren",
  "product.print_labels": "Barcode-Etiketten drucken",
  // Preise
  "price.view": "Verkaufspreise ansehen",
  "price.view_cost": "Einkaufspreise und Marge ansehen",
  "price.edit": "Preise, Preislisten, Staffeln, Sonderpreise ändern",
  "price.promotions": "Aktionen verwalten",
  "price.bulk": "Massenänderung und CSV-Import von Preisen",
  "price.confirm_below_margin": "Preise unter Mindestmarge bestätigen",
  // Kunden
  "customer.view": "Kunden ansehen",
  "customer.edit": "Kunden bearbeiten",
  "customer.approve": "Händler freigeben/ablehnen",
  "customer.credit": "Zahlungsziel und Kreditlimit festlegen",
  "customer.block": "Kunden sperren",
  // Angebote
  "quote.view": "Angebote ansehen",
  "quote.edit": "Angebote erstellen/bearbeiten",
  // Bestellungen
  "order.view": "Bestellungen ansehen",
  "order.edit": "Bestellungen bearbeiten (vor Bestätigung)",
  "order.edit_price": "Positionspreise manuell ändern",
  "order.confirm": "Bestellungen bestätigen",
  "order.cancel": "Bestellungen stornieren",
  "order.status": "Bestellstatus weiterschalten",
  "order.print": "Bestelldokumente drucken",
  // Lager
  "stock.view": "Bestand ansehen",
  "stock.receive": "Wareneingang buchen",
  "stock.pick": "Kommissionieren",
  "stock.adjust": "Bestandskorrekturen",
  "stock.stocktake": "Inventur durchführen",
  "stock.bins": "Lagerplätze verwalten",
  // Einkauf
  "purchase.view": "Einkauf ansehen",
  "purchase.edit": "Lieferanten und Einkaufsbestellungen bearbeiten",
  // Lieferung
  "delivery.plan": "Touren planen und Fahrer zuordnen",
  "delivery.view_all": "Alle Touren ansehen",
  "delivery.driver": "Eigene Tour fahren, Lieferung bestätigen, Bargeld erfassen",
  "delivery.cash_closing": "Kassenabschluss prüfen und freigeben",
  // Finanzen
  "finance.view": "Rechnungen, Zahlungen, offene Posten ansehen",
  "finance.invoice": "Rechnungen erstellen",
  "finance.payment": "Zahlungen erfassen und zuordnen",
  "finance.credit_note": "Gutschriften und Retouren",
  "finance.dunning": "Mahnungen",
  "finance.export": "Exporte für Steuerberater",
  // Berichte
  "report.view": "Berichte ansehen",
  "report.export": "Berichte exportieren",
  // Verwaltung
  "settings.view": "Einstellungen ansehen",
  "settings.edit": "Einstellungen ändern",
  "user.manage": "Benutzer und Rollen verwalten",
  "audit.view": "Audit-Log ansehen",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
export const WILDCARD = "*";

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

export function hasPermission(granted: Iterable<string>, required: Permission): boolean {
  for (const g of granted) {
    if (g === WILDCARD || g === required) return true;
  }
  return false;
}

export function hasAllPermissions(granted: Iterable<string>, required: readonly Permission[]): boolean {
  const set = new Set(granted);
  if (set.has(WILDCARD)) return true;
  return required.every((r) => set.has(r));
}

export function hasAnyPermission(granted: Iterable<string>, required: readonly Permission[]): boolean {
  const set = new Set(granted);
  if (set.has(WILDCARD)) return true;
  return required.some((r) => set.has(r));
}

/** Vereinigt die Rechte mehrerer Rollen; unbekannte Schlüssel werden verworfen. */
export function mergeRolePermissions(roles: readonly { permissions: readonly string[] }[]): Set<string> {
  const out = new Set<string>();
  for (const r of roles) {
    for (const p of r.permissions) {
      if (p === WILDCARD || isPermission(p)) out.add(p);
    }
  }
  return out;
}

export type SystemRoleKey = "owner" | "sales" | "pricing" | "warehouse" | "driver" | "accounting";

export interface SystemRoleDefinition {
  key: SystemRoleKey;
  nameAr: string;
  nameEn: string;
  permissions: readonly string[];
}

/** Standardrollen (Abschnitt 5.1). Werden geseedet und sind danach im Admin änderbar. */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  { key: "owner", nameAr: "المالك", nameEn: "Owner", permissions: [WILDCARD] },
  {
    key: "sales",
    nameAr: "المبيعات",
    nameEn: "Sales",
    permissions: [
      "dashboard.view",
      "product.view",
      "price.view",
      "customer.view",
      "customer.edit",
      "customer.approve",
      "quote.view",
      "quote.edit",
      "order.view",
      "order.edit",
      "order.confirm",
      "order.cancel",
      "order.status",
      "order.print",
      "stock.view",
      "finance.view",
      "report.view",
    ],
  },
  {
    key: "pricing",
    nameAr: "إدارة الأسعار",
    nameEn: "Pricing",
    permissions: [
      "dashboard.view",
      "product.view",
      "price.view",
      "price.view_cost",
      "price.edit",
      "price.promotions",
      "price.bulk",
      "price.confirm_below_margin",
      "customer.view",
      "report.view",
    ],
  },
  {
    key: "warehouse",
    nameAr: "المستودع",
    nameEn: "Warehouse",
    permissions: [
      "dashboard.view",
      "product.view",
      "product.print_labels",
      "order.view",
      "order.status",
      "order.print",
      "stock.view",
      "stock.receive",
      "stock.pick",
      "stock.adjust",
      "stock.stocktake",
      "stock.bins",
      "purchase.view",
      "delivery.plan",
      "delivery.view_all",
    ],
  },
  {
    key: "driver",
    nameAr: "السائق",
    nameEn: "Driver",
    permissions: ["delivery.driver"],
  },
  {
    key: "accounting",
    nameAr: "المحاسبة",
    nameEn: "Accounting",
    permissions: [
      "dashboard.view",
      "dashboard.view_margin",
      "customer.view",
      "customer.credit",
      "order.view",
      "order.print",
      "price.view",
      "price.view_cost",
      "finance.view",
      "finance.invoice",
      "finance.payment",
      "finance.credit_note",
      "finance.dunning",
      "finance.export",
      "delivery.cash_closing",
      "report.view",
      "report.export",
    ],
  },
];
