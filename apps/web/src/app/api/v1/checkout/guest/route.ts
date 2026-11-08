import { guestPreviewSchema } from "@sa/contracts";
import { apiRoute, parseJson } from "@/server/http";
import { guestPreview } from "@/server/services/guest-checkout";

/** Kassen-Vorschau für Gäste (ohne Konto) */
export const POST = apiRoute(async (req) => guestPreview(await parseJson(req, guestPreviewSchema)));
