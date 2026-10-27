import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { driverCash, driverTours } from "@/server/services/delivery";

/** Fahrer-App/-Ansicht: eigene Touren (heute und offene) + offenes Bargeld */
export const GET = apiRoute(async () => {
  const ctx = await requireStaff("delivery.driver");
  const [tours, cash] = await Promise.all([driverTours(ctx.user.id), driverCash(ctx.user.id)]);
  return { tours, cash };
});
