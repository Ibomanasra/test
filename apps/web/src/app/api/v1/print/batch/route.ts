import { businessDate } from "@sa/core";
import { getAuth } from "@/server/auth/context";
import { badRequest, unauthorized } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { parseLang, pdfResponse } from "@/server/pdf-response";
import { batchPdf, isDocSlug, orderDocumentRefs, type DocSlug } from "@/server/services/documents";

/**
 * Sammeldruck in EINEM PDF.
 *  - Bestellungen: ?doc=delivery-note,invoice&ids=<orderId>,…  (delivery-note-np = ohne Preise)
 *  - Beliebige Belege: ?items=invoice:<id>,receipt:<id>,…
 */
export const GET = apiRoute(async (req) => {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  const q = req.nextUrl.searchParams;
  const lang = parseLang(q.get("lang"));
  let refs: { slug: DocSlug; id: string; opts?: { withPrices?: boolean } }[] = [];
  if (q.get("items")) {
    refs = q
      .get("items")!
      .split(",")
      .map((s) => s.split(":"))
      .map(([slug, ...rest]) => {
        if (!slug || !isDocSlug(slug) || rest.length === 0) throw badRequest("invalid_items");
        return { slug, id: rest.join(":") };
      });
  } else {
    const docs = (q.get("doc") ?? "").split(",").filter(Boolean);
    const ids = (q.get("ids") ?? "").split(",").filter(Boolean);
    if (!docs.length || !ids.length) throw badRequest("invalid_items");
    refs = await orderDocumentRefs(ids, docs);
  }
  const pdf = await batchPdf(ctx, refs, lang);
  return pdfResponse(pdf, `batch-${businessDate(new Date())}.pdf`, q.get("download") === "1");
});
