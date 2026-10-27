import "server-only";
import { hasPermission, type Permission } from "@sa/core";
import { redirect } from "next/navigation";
import { getAuth, type AuthContext } from "./context";

/**
 * Guards für Server-Komponenten (Seiten/Layouts). Leiten zum Login um bzw.
 * liefern null, wenn das Recht fehlt (Seite zeigt dann "Kein Zugriff").
 */
export async function requireStaffPage(locale: string): Promise<AuthContext> {
  const ctx = await getAuth();
  if (!ctx || !ctx.isStaff) redirect(`/${locale}/admin/login`);
  return ctx;
}

/** Mitarbeiterseite: mindestens eines der Rechte nötig */
export async function staffPagePermission(locale: string, ...permissions: Permission[]): Promise<AuthContext | null> {
  const ctx = await requireStaffPage(locale);
  return permissions.some((p) => hasPermission(ctx.permissions, p)) ? ctx : null;
}

export async function requireCustomerPage(locale: string, next?: string): Promise<AuthContext> {
  const ctx = await getAuth();
  if (!ctx || !ctx.customer) {
    redirect(`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  return ctx;
}
