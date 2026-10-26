import { taxRateCreateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { addTaxRate, listTaxRates } from "@/server/services/settings";

export const GET = apiRoute(async () => {
  await requireStaff("settings.view");
  return { items: await listTaxRates() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return addTaxRate(ctx, await parseJson(req, taxRateCreateSchema));
});
