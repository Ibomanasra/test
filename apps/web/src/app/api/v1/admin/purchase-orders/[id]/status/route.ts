import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { setPurchaseOrderStatus } from "@/server/services/inventory";

const schema = z.object({ to: z.enum(["ORDERED", "CANCELLED"]) });

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("purchase.edit");
  await setPurchaseOrderStatus(ctx, (await params).id, (await parseJson(req, schema)).to);
  return { ok: true };
});
