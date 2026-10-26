import { companySettingsSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { getCompanySettings, updateCompanySettings } from "@/server/services/settings";

export const GET = apiRoute(async () => {
  await requireStaff("settings.view");
  return getCompanySettings();
});

export const PUT = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return updateCompanySettings(ctx, await parseJson(req, companySettingsSchema));
});
