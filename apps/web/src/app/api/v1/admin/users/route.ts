import { staffCreateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { createStaff, listStaff } from "@/server/services/staff";

export const GET = apiRoute(async () => {
  await requireStaff("user.manage");
  return { items: await listStaff() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("user.manage");
  return createStaff(ctx, await parseJson(req, staffCreateSchema));
});
