import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { listPaymentMethods } from "@/server/services/settings";

export const GET = apiRoute(async () => {
  await requireStaff("settings.view");
  return { items: await listPaymentMethods() };
});
