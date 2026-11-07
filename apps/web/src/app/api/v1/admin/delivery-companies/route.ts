import { deliveryCompanySchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { listDeliveryCompanies, saveDeliveryCompany } from "@/server/services/delivery-companies";

export const GET = apiRoute(async () => {
  await requireStaff("order.view");
  return { items: await listDeliveryCompanies() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return saveDeliveryCompany(ctx, null, await parseJson(req, deliveryCompanySchema));
});
