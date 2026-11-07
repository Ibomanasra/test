import { deliveryCompanySchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { saveDeliveryCompany } from "@/server/services/delivery-companies";

export const PATCH = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("settings.edit");
  return saveDeliveryCompany(ctx, (await params).id, await parseJson(req, deliveryCompanySchema));
});
