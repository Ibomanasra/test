import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { refundCardPayment } from "@/server/services/card-payments";

/** Kartenzahlung erstatten (Betrag optional; Standard = erstattbarer Betrag) */
export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("finance.payment");
  const { amount } = await parseJson(req, z.object({ amount: z.number().int().min(1).optional() }));
  return refundCardPayment(ctx, (await params).id, amount);
});
