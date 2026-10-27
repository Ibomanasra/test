import { autoPrintRuleSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { deleteAutoPrintRule, saveAutoPrintRule } from "@/server/services/document-settings";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("settings.edit");
  return saveAutoPrintRule(ctx, (await params).id, await parseJson(req, autoPrintRuleSchema));
});

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("settings.edit");
  await deleteAutoPrintRule(ctx, (await params).id);
  return { ok: true };
});
