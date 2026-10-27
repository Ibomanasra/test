import { paymentVoidSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { voidPayment } from "@/server/services/finance";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("finance.payment");
  await voidPayment(ctx, (await params).id, (await parseJson(req, paymentVoidSchema)).reason);
  return { ok: true };
});
