import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { settleCourier } from "@/server/services/delivery-companies";

const schema = z.object({ shipmentIds: z.array(z.string().max(64)).max(500).optional(), note: z.string().trim().max(300).optional() });

/** Geld von der Zustellfirma erhalten (kassierte Nachnahmen) */
export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("finance.payment");
  const input = await parseJson(req, schema);
  return settleCourier(ctx, (await params).id, input.shipmentIds, input.note || undefined);
});
