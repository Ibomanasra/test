import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { approveCashClosing } from "@/server/services/delivery";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("delivery.cash_closing");
  const { note } = await parseJson(req, z.object({ note: z.string().trim().max(300).optional() }));
  await approveCashClosing(ctx, (await params).id, note);
  return { ok: true };
});
