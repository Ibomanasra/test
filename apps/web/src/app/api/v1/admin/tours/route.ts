import { tourCreateSchema } from "@sa/contracts";
import { requireStaff, requireStaffAny } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { createTour, listTours } from "@/server/services/delivery";

export const GET = apiRoute(async (req) => {
  await requireStaffAny("delivery.plan", "delivery.view_all");
  return { items: await listTours({ date: req.nextUrl.searchParams.get("date") ?? undefined }) };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("delivery.plan");
  const t = await createTour(ctx, await parseJson(req, tourCreateSchema));
  return { id: t.id, number: t.number };
});
