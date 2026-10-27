import { tourStopsSchema } from "@sa/contracts";
import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { addTourStops, reorderStops } from "@/server/services/delivery";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("delivery.plan");
  await addTourStops(ctx, (await params).id, (await parseJson(req, tourStopsSchema)).shipmentIds);
  return { ok: true };
});

/** neue Reihenfolge: { stopIds: [...] } */
export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("delivery.plan");
  await reorderStops(ctx, (await params).id, (await parseJson(req, z.object({ stopIds: z.array(z.string()).max(200) }))).stopIds);
  return { ok: true };
});
