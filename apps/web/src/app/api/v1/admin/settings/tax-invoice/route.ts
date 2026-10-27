import { taxInvoiceFieldsSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { updateTaxInvoiceFields } from "@/server/services/document-settings";

export const PUT = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return updateTaxInvoiceFields(ctx, await parseJson(req, taxInvoiceFieldsSchema));
});
