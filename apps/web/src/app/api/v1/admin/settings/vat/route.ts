import { vatSwitchSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { setVatNow } from "@/server/services/settings";

/** MwSt. ab sofort ein-/ausschalten (z. B. 0 % ↔ 16 %) */
export const PUT = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return setVatNow(ctx, (await parseJson(req, vatSwitchSchema)).rateBps);
});
