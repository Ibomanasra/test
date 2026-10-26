import { roleUpsertSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { deleteRole, upsertRole } from "@/server/services/staff";

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("user.manage");
  return upsertRole(ctx, (await params).id, await parseJson(req, roleUpsertSchema));
});

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("user.manage");
  await deleteRole(ctx, (await params).id);
  return { ok: true };
});
