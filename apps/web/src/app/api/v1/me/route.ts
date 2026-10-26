import { getAuth } from "@/server/auth/context";
import { unauthorized } from "@/server/errors";
import { apiRoute } from "@/server/http";

export const GET = apiRoute(async () => {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  return {
    user: ctx.user,
    isStaff: ctx.isStaff,
    roles: ctx.roleKeys,
    permissions: [...ctx.permissions],
    customer: ctx.customer,
    channel: ctx.channel,
  };
});
