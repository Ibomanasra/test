import "server-only";
import { hasPermission, type Permission } from "@sa/core";
import { staffPagePermission } from "@/server/auth/page-guards";

/** Seite braucht price.view; Bearbeiten das jeweilige Recht. */
export async function pricePage(locale: string, editPermission: Permission = "price.edit") {
  const auth = await staffPagePermission(locale, "price.view");
  if (!auth) return null;
  return {
    auth,
    canEdit: hasPermission(auth.permissions, editPermission),
    canSeeCost: hasPermission(auth.permissions, "price.view_cost"),
  };
}
