import { bankAccountSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { listBankAccounts, saveBankAccount } from "@/server/services/document-settings";

export const GET = apiRoute(async () => {
  await requireStaff("settings.view");
  return { items: await listBankAccounts() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return saveBankAccount(ctx, null, await parseJson(req, bankAccountSchema));
});
