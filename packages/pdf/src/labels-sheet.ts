import { formatMoney } from "@sa/core";
import { code128Svg } from "./barcode";
import { FONT_STACK, fontFaceCss } from "./fonts";
import { esc } from "./html";

export interface ProductLabel {
  code: string;
  nameAr: string;
  nameEn?: string | null;
  /** Preis in Agorot (optional, z. B. B2C brutto) */
  price?: number | null;
}

/** A4-Etikettenbogen (Standard 3 × 8, 70 × 37 mm) mit Code-128 */
export function renderLabelSheetHtml(labels: ProductLabel[], opts: { cols?: number; rows?: number } = {}): string {
  const cols = opts.cols ?? 3;
  const rows = opts.rows ?? 8;
  const w = 210 / cols;
  const h = 297 / rows;
  const cells = labels
    .map(
      (l) => `<div class="label">
  <div class="name">${esc(l.nameAr)}</div>
  ${l.nameEn ? `<div class="name-en" dir="ltr">${esc(l.nameEn)}</div>` : ""}
  <div class="code">${code128Svg(l.code, { heightMm: Math.min(10, h * 0.32), moduleMm: 0.25 })}</div>
  ${l.price != null ? `<div class="price"><span dir="ltr">${esc(formatMoney(l.price, { symbol: false }))}</span> ₪</div>` : ""}
</div>`,
    )
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
${fontFaceCss()}
@page { size: A4; margin: 0; }
body { margin: 0; font-family: ${FONT_STACK}; }
.sheet { display: grid; grid-template-columns: repeat(${cols}, ${w}mm); grid-auto-rows: ${h}mm; }
.label { box-sizing: border-box; padding: 2.5mm 3mm; overflow: hidden; break-inside: avoid; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.name { font-size: 8.5pt; font-weight: 600; line-height: 1.2; max-height: 2.4em; overflow: hidden; }
.name-en { font-size: 7pt; color: #4b5563; }
.code { margin-top: 1mm; }
.price { font-size: 11pt; font-weight: 700; margin-top: 0.5mm; }
</style></head><body><div class="sheet">${cells}</div></body></html>`;
}
