import { sequenceUpdateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { updateSequence } from "@/server/services/document-settings";

/** id = Belegart (z. B. INVOICE) */
export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("settings.edit");
  return updateSequence(ctx, (await params).id, await parseJson(req, sequenceUpdateSchema));
});
