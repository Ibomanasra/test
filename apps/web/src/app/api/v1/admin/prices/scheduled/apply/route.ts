import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { applyDueScheduledPrices } from "@/server/services/prices-admin";

export const POST = apiRoute(async () => {
  await requireStaff("price.edit");
  return { applied: await applyDueScheduledPrices() };
});
