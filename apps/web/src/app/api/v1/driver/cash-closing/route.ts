import { cashClosingSubmitSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { submitCashClosing } from "@/server/services/delivery";

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("delivery.driver");
  const c = await submitCashClosing(ctx, await parseJson(req, cashClosingSubmitSchema));
  return { id: c.id, number: c.number, expected: c.expected, counted: c.counted, difference: c.difference };
});
