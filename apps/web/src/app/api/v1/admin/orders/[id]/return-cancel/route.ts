import { orderFailSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { cancelAfterHandover } from "@/server/services/orders";

/** Zustellfirma meldet Storno/Rücksendung: Ware zurück, Rechnung gutgeschrieben, Bestellung storniert */
export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("order.cancel");
  const { reason } = await parseJson(req, orderFailSchema);
  await cancelAfterHandover(ctx, (await params).id, reason);
  return { ok: true };
});
