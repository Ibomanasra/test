import { roleUpsertSchema } from "@sa/contracts";
import { PERMISSIONS } from "@sa/core";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { listRoles, upsertRole } from "@/server/services/staff";

export const GET = apiRoute(async () => {
  await requireStaff("user.manage");
  return { items: await listRoles(), permissions: Object.keys(PERMISSIONS) };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("user.manage");
  return upsertRole(ctx, null, await parseJson(req, roleUpsertSchema));
});
