import { z } from "zod";
import { requireStaffAny } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { setTourStatus } from "@/server/services/delivery";

const schema = z.object({ status: z.enum(["LOADED", "ON_ROUTE", "COMPLETED"]) });

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaffAny("delivery.plan", "delivery.driver");
  await setTourStatus(ctx, (await params).id, (await parseJson(req, schema)).status);
  return { ok: true };
});
