import { bankAccountSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { deleteBankAccount, saveBankAccount } from "@/server/services/document-settings";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("settings.edit");
  return saveBankAccount(ctx, (await params).id, await parseJson(req, bankAccountSchema));
});

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("settings.edit");
  await deleteBankAccount(ctx, (await params).id);
  return { ok: true };
});
