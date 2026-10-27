import { chromium, type Browser } from "playwright-core";
import { PAGE_MARGIN, headerFooter, renderDocumentHtml } from "./template";
import type { DocLang, DocumentModel } from "./model";

/**
 * HTML → PDF mit Chromium (Playwright). Ein Browser pro Prozess, ein Kontext pro Dokument.
 * Chromium-Pfad: PDF_CHROMIUM_PATH (z. B. /usr/bin/chromium im Docker-Image), sonst Playwright-Standard.
 */

let browser: Promise<Browser> | undefined;

function getBrowser(): Promise<Browser> {
  browser ??= chromium
    .launch({ executablePath: process.env.PDF_CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--font-render-hinting=none"] })
    .then((b) => {
      b.on("disconnected", () => {
        browser = undefined;
      });
      return b;
    })
    .catch((err: unknown) => {
      browser = undefined;
      throw err;
    });
  return browser;
}

export async function closePdfBrowser(): Promise<void> {
  const b = browser;
  browser = undefined;
  if (b) await (await b).close().catch(() => undefined);
}

export interface PdfOptions {
  landscape?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  /** Seitenränder überschreiben (Etikettenbögen: 0) */
  marginMm?: number;
}

export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Buffer> {
  const b = await getBrowser();
  const ctx = await b.newContext();
  try {
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate("document.fonts.ready.then(() => true)");
    const pdf = await page.pdf({
      format: "A4",
      landscape: opts.landscape,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: !!(opts.headerTemplate || opts.footerTemplate),
      headerTemplate: opts.headerTemplate ?? "<span></span>",
      footerTemplate: opts.footerTemplate ?? "<span></span>",
      margin:
        opts.marginMm != null
          ? { top: `${opts.marginMm}mm`, right: `${opts.marginMm}mm`, bottom: `${opts.marginMm}mm`, left: `${opts.marginMm}mm` } // logical-css-ignore (Playwright-API)
          : { top: PAGE_MARGIN.top, right: PAGE_MARGIN.side, bottom: PAGE_MARGIN.bottom, left: PAGE_MARGIN.side }, // logical-css-ignore
    });
    return Buffer.from(pdf);
  } finally {
    await ctx.close();
  }
}

/** Dokumentmodell → PDF */
export async function renderDocumentPdf(doc: DocumentModel, lang: DocLang): Promise<Buffer> {
  const html = await renderDocumentHtml(doc, lang);
  return htmlToPdf(html, { landscape: doc.landscape, ...headerFooter(doc, lang) });
}
