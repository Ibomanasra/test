import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { deleteFutureTaxRate } from "@/server/services/settings";

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("settings.edit");
  await deleteFutureTaxRate(ctx, (await params).id);
  return { ok: true };
});
