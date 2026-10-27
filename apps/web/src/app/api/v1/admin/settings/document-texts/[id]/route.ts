import { documentTextSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { deleteDocumentText, saveDocumentText } from "@/server/services/document-settings";

/** Upsert über (Belegart, Sprache) – die ID dient nur der Adressierung im Editor */
export const PUT = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return saveDocumentText(ctx, await parseJson(req, documentTextSchema));
});

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("settings.edit");
  await deleteDocumentText(ctx, (await params).id);
  return { ok: true };
});
