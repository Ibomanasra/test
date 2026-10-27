import type { Permission } from "@sa/core";

export interface AdminNavItem {
  key: string;
  href: string;
  /** Mindestens eines dieser Rechte nötig */
  anyOf: Permission[];
  /** Noch nicht umgesetzt → Platzhalter-Seite mit Phasen-Hinweis (siehe ROADMAP.md) */
  plannedPhase?: number;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { key: "dashboard", href: "/admin", anyOf: ["dashboard.view"] },
  { key: "orders", href: "/admin/orders", anyOf: ["order.view"] },
  { key: "customers", href: "/admin/customers", anyOf: ["customer.view"] },
  { key: "quotes", href: "/admin/quotes", anyOf: ["quote.view"] },
  { key: "documents", href: "/admin/documents", anyOf: ["finance.view", "order.print"] },
  { key: "products", href: "/admin/products", anyOf: ["product.view"] },
  { key: "prices", href: "/admin/prices", anyOf: ["price.view", "price.edit"] },
  { key: "stock", href: "/admin/stock", anyOf: ["stock.view"], plannedPhase: 5 },
  { key: "purchasing", href: "/admin/purchasing", anyOf: ["purchase.view"], plannedPhase: 5 },
  { key: "delivery", href: "/admin/delivery", anyOf: ["delivery.plan", "delivery.view_all", "delivery.cash_closing"], plannedPhase: 5 },
  { key: "finance", href: "/admin/finance", anyOf: ["finance.view"], plannedPhase: 5 },
  { key: "reports", href: "/admin/reports", anyOf: ["report.view"], plannedPhase: 5 },
  { key: "users", href: "/admin/users", anyOf: ["user.manage"] },
  { key: "roles", href: "/admin/roles", anyOf: ["user.manage"] },
  { key: "settings", href: "/admin/settings", anyOf: ["settings.view"] },
  { key: "audit", href: "/admin/audit", anyOf: ["audit.view"] },
];

export const PLANNED_MODULES = new Map(ADMIN_NAV.filter((i) => i.plannedPhase).map((i) => [i.href.split("/").pop()!, i]));
