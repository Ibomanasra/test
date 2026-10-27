import { documentTextSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { listDocumentTexts, saveDocumentText } from "@/server/services/document-settings";

export const GET = apiRoute(async () => {
  await requireStaff("settings.view");
  return { items: await listDocumentTexts() };
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  return saveDocumentText(ctx, await parseJson(req, documentTextSchema));
});
