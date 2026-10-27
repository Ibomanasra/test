import { paymentCreateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { recordPayment } from "@/server/services/finance";

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("finance.payment");
  return recordPayment(ctx, await parseJson(req, paymentCreateSchema));
});
