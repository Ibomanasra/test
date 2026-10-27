import { autoPrintRuleSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { listAutoPrintRules, saveAutoPrintRule } from "@/server/services/document-settings";

export const GET = apiRoute(async () => {
  await requireStaff("settings.view");
  return { items: await listAutoPrintRules() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return saveAutoPrintRule(ctx, null, await parseJson(req, autoPrintRuleSchema));
});
