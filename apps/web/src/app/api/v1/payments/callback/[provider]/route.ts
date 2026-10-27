import { apiRoute } from "@/server/http";
import { handleCallback } from "@/server/services/card-payments";

/** Server-zu-Server-Benachrichtigung des Gateways (Signatur wird im Adapter geprüft) */
export const POST = apiRoute<{ provider: string }>(async (req, { params }) => {
  const status = await handleCallback((await params).provider, await req.text(), req.headers);
  return { ok: true, status };
});
