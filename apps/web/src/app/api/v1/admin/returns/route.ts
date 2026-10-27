import { returnCreateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { createReturn } from "@/server/services/finance";

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("finance.credit_note");
  return createReturn(ctx, await parseJson(req, returnCreateSchema));
});
