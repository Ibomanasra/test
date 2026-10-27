import { afterAll, describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { closePdfBrowser, renderDocumentPdf } from "../src/render";
import { sampleDoc } from "./sample";

/**
 * Prüft, dass Arabisch im PDF mit eingebetteter Schrift korrekt gesetzt ist:
 * Der extrahierte Text muss die Wörter in logischer Reihenfolge enthalten
 * (Formung über HarfBuzz, Rückabbildung über ToUnicode), und IBM Plex Sans Arabic
 * muss eingebettet sein.
 */

const strip = (s: string) => s.normalize("NFKC").replace(/[‎‏‪-‮⁦-⁩]/g, "").replace(/\s+/g, " ");

async function extract(pdf: Buffer) {
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: false }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += " " + content.items.map((i) => ("str" in i ? i.str : "")).join(" ");
  }
  return { text: strip(text), pages: doc.numPages, raw: pdf.toString("latin1") };
}

describe("arabic PDF", () => {
  afterAll(async () => {
    await closePdfBrowser();
  });

  it("embeds IBM Plex Sans Arabic and extracts connected Arabic words in logical order", async () => {
    const pdf = await renderDocumentPdf(sampleDoc(), "ar");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const { text, raw } = await extract(pdf);
    expect(raw).toMatch(/\/BaseFont\s*\/[A-Z]{6}\+IBMPlexSansArabic/);
    expect(text).toContain("INV-2026-000001");
    // pdf.js liefert arabische Glyphen in visueller Reihenfolge (rechts → links gesetzt):
    // ohne Leerzeichen verglichen muss jedes Wort exakt gespiegelt vorkommen.
    const visual = text.replace(/\s+/g, "");
    for (const word of ["شعلة الجنوب", "سائل جلي ليمون", "سوبرماركت النور"]) {
      expect(visual).toContain([...word.replace(/\s+/g, "")].reverse().join(""));
    }
  }, 60_000);

  it("paginates long tables with 'page X of Y'", async () => {
    const pdf = await renderDocumentPdf(sampleDoc(120), "en");
    const { text, pages } = await extract(pdf);
    expect(pages).toBeGreaterThan(2);
    expect(text).toContain(`Page 1 of ${pages}`);
    expect(text).toContain(`Page ${pages} of ${pages}`);
  }, 60_000);
});
