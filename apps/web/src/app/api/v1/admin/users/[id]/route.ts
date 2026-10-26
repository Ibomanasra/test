import { staffUpdateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { updateStaff } from "@/server/services/staff";

export const PATCH = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("user.manage");
  return updateStaff(ctx, (await params).id, await parseJson(req, staffUpdateSchema));
});
