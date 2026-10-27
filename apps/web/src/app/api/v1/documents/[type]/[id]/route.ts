import { getAuth } from "@/server/auth/context";
import { notFound, unauthorized } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { parseLang, pdfResponse } from "@/server/pdf-response";
import { documentPdf, isDocSlug } from "@/server/services/documents";

/** GET /api/v1/documents/{type}/{id}?lang=ar|en|bi&prices=0&from=&to=&download=1 */
export const GET = apiRoute<{ type: string; id: string }>(async (req, { params }) => {
  const { type, id } = await params;
  if (!isDocSlug(type)) throw notFound();
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  const q = req.nextUrl.searchParams;
  const doc = await documentPdf(ctx, type, id, parseLang(q.get("lang")), {
    withPrices: q.get("prices") !== "0",
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
  });
  return pdfResponse(doc.pdf, doc.filename, q.get("download") === "1");
});
