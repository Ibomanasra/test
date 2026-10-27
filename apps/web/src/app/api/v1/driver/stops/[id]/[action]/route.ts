import { deliverStopSchema, failStopSchema } from "@sa/contracts";
import { requireStaffAny } from "@/server/auth/context";
import { notFound } from "@/server/errors";
import { apiRoute, parseJson } from "@/server/http";
import { deliverStop, failStop } from "@/server/services/delivery";

/** POST …/deliver { receivedByName, cashAmount, signature } | …/fail { reason } */
export const POST = apiRoute<{ id: string; action: string }>(async (req, { params }) => {
  const { id, action } = await params;
  const ctx = await requireStaffAny("delivery.driver", "delivery.plan");
  if (action === "deliver") await deliverStop(ctx, id, await parseJson(req, deliverStopSchema));
  else if (action === "fail") await failStop(ctx, id, (await parseJson(req, failStopSchema)).reason);
  else throw notFound();
  return { ok: true };
});
