import { businessDate } from "@sa/core";
import { renderDocumentPdf, type DocumentModel } from "@sa/pdf";
import { z } from "zod";
import { getAuth } from "@/server/auth/context";
import { forbidden, unauthorized } from "@/server/errors";
import { apiRoute, parseJson } from "@/server/http";
import { parseLang, pdfResponse } from "@/server/pdf-response";
import { sellerSnapshot } from "@/server/services/invoicing";

/**
 * Jede Liste im Admin als A4-PDF: Die Seite schickt die angezeigten Spalten/Zeilen
 * (bereits gefiltert und rechtegeprüft beim Laden der Seite). Nur für Mitarbeiter.
 */
const text = z.union([z.string().max(300), z.object({ ar: z.string().max(300), en: z.string().max(300) })]);
const schema = z.object({
  title: text,
  subtitle: text.optional(),
  lang: z.enum(["ar", "en", "bi"]).optional(),
  landscape: z.boolean().optional(),
  columns: z.array(z.object({ key: z.string().max(60), label: text, kind: z.enum(["text", "num", "money"]).optional() })).min(1).max(20),
  rows: z.array(z.record(z.string(), z.union([z.string().max(2000), z.number(), z.null()]))).max(5000),
});

const i18n = (v: z.infer<typeof text>) => (typeof v === "string" ? { ar: v, en: v } : v);

export const POST = apiRoute(async (req) => {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  if (!ctx.isStaff) throw forbidden();
  const input = await parseJson(req, schema);
  const model: DocumentModel = {
    kind: "REPORT",
    title: i18n(input.title),
    number: businessDate(new Date()),
    company: { ...(await sellerSnapshot()), logoDataUrl: null },
    meta: input.subtitle ? [{ label: { ar: "", en: "" }, value: i18n(input.subtitle) }] : [],
    tables: [{ columns: input.columns.map((c) => ({ key: c.key, label: i18n(c.label), kind: c.kind })), rows: input.rows.map((r) => ({ cells: r })) }],
    landscape: input.landscape ?? input.columns.length > 7,
    showBanks: false,
  };
  const pdf = await renderDocumentPdf(model, input.lang ?? parseLang(req.nextUrl.searchParams.get("lang")) ?? (ctx.user.locale === "en" ? "en" : "ar"));
  return pdfResponse(pdf, `list-${businessDate(new Date())}.pdf`);
});
