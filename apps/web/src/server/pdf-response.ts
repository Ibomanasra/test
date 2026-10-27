import "server-only";
import type { DocLang } from "@sa/pdf";

export function parseLang(v: string | null): DocLang | null {
  return v === "ar" || v === "en" || v === "bi" ? v : null;
}

/** PDF inline (Browser-Vorschau) oder als Download (?download=1) */
export function pdfResponse(pdf: Uint8Array, filename: string, download = false): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(filename)}"`,
      "Content-Length": String(pdf.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
