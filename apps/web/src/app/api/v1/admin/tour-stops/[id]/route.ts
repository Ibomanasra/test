import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { removeTourStop } from "@/server/services/delivery";

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("delivery.plan");
  await removeTourStop(ctx, (await params).id);
  return { ok: true };
});
