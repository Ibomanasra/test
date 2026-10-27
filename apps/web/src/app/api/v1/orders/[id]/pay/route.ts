import { requireCustomer } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { startCardPayment } from "@/server/services/card-payments";

/** Kartenzahlung starten → { redirectUrl } zur gehosteten Bezahlseite */
export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCustomer();
  const locale = req.headers.get("accept-language")?.startsWith("en") ? "en" : "ar";
  return startCardPayment(ctx, (await params).id, locale);
});
