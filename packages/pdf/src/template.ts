import { formatMoney } from "@sa/core";
import { code128Svg } from "./barcode";
import { FONT_STACK, fontFaceCss } from "./fonts";
import { dirOf, esc, isI18n, tx, txInline } from "./html";
import { L } from "./labels";
import type { Cell, DocColumn, DocLang, DocTable, DocumentModel } from "./model";
import { qrSvg } from "./qr";

export const PAGE_MARGIN = { top: "15mm", side: "12mm", bottom: "18mm" } as const;

const money = (a: number) => formatMoney(a, { symbol: false });

function css(lang: DocLang, landscape: boolean): string {
  return `
${fontFaceCss()}
@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: ${PAGE_MARGIN.top} ${PAGE_MARGIN.side} ${PAGE_MARGIN.bottom}; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${FONT_STACK}; font-size: 9.5pt; line-height: 1.45; color: #111827; }
.num, .money { font-variant-numeric: tabular-nums; unicode-bidi: isolate; direction: ltr; }
.bi-ar { display: block; }
.bi-en { display: block; font-size: 0.82em; color: #4b5563; }
h1 { font-size: 16pt; margin: 0; color: #7c2d12; }
h2 { font-size: 11pt; margin: 6mm 0 2mm; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm; border-bottom: 1.2pt solid #9a3412; padding-bottom: 3mm; margin-bottom: 4mm; }
.company { display: flex; gap: 4mm; align-items: flex-start; }
.company img { max-height: 20mm; max-width: 35mm; object-fit: contain; }
.company .name { font-size: 13pt; font-weight: 700; }
.company .name-en { font-size: 10pt; font-weight: 600; color: #374151; }
.company .small { font-size: 8pt; color: #374151; }
.doc-id { text-align: end; display: flex; gap: 3mm; align-items: flex-start; }
.doc-id .number { font-size: 11pt; font-weight: 600; margin-top: 1mm; }
.stamp { display: inline-block; margin-top: 2mm; border: 1.5pt solid #b91c1c; color: #b91c1c; padding: 0.5mm 3mm; font-weight: 700; transform: rotate(-4deg); }
.meta { display: grid; grid-template-columns: repeat(${landscape ? 4 : 3}, 1fr); gap: 1.5mm 6mm; margin-bottom: 4mm; }
.meta .label { color: #6b7280; font-size: 8pt; }
.meta .value { font-weight: 600; }
.parties { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm; margin-bottom: 4mm; }
.party { border: 0.6pt solid #d1d5db; border-radius: 2mm; padding: 2.5mm 3mm; break-inside: avoid; }
.party .label { color: #6b7280; font-size: 8pt; margin-bottom: 1mm; }
.intro p { margin: 0 0 2mm; }
table.lines { width: 100%; border-collapse: collapse; margin-top: 2mm; }
table.lines thead { display: table-header-group; }
table.lines th { background: #f3f4f6; border-bottom: 0.8pt solid #9ca3af; font-size: 8pt; font-weight: 600; padding: 1.5mm 1.5mm; text-align: start; vertical-align: bottom; }
table.lines td { border-bottom: 0.4pt solid #e5e7eb; padding: 1.4mm 1.5mm; vertical-align: top; white-space: pre-line; }
table.lines tr { break-inside: avoid; page-break-inside: avoid; }
table.lines td.end, table.lines th.end { text-align: end; }
table.lines td.center, table.lines th.center { text-align: center; }
table.lines tr.group td { background: #fff7ed; font-weight: 600; }
table.lines tr.muted td { color: #9ca3af; }
table.lines td .barcode { display: block; }
.check { display: inline-block; width: 4mm; height: 4mm; border: 0.8pt solid #374151; }
.empty { color: #6b7280; padding: 3mm 0; }
.totals { margin-top: 4mm; margin-inline-start: auto; width: ${landscape ? "40%" : "55%"}; border-collapse: collapse; break-inside: avoid; }
.totals td { padding: 1mm 1.5mm; }
.totals td.amount { text-align: end; }
.totals tr.strong td { font-weight: 700; font-size: 11pt; border-top: 1pt solid #111827; }
.notes { margin-top: 5mm; font-size: 8.5pt; color: #374151; break-inside: avoid; }
.notes p { margin: 0 0 1.5mm; white-space: pre-line; }
.signatures { display: flex; gap: 10mm; margin-top: 12mm; break-inside: avoid; }
.signatures .sig { flex: 1; border-top: 0.8pt solid #111827; padding-top: 1.5mm; font-size: 8.5pt; }
.signatures .sig .line { color: #6b7280; font-size: 7.5pt; margin-top: 5mm; }
`;
}

function alignClass(c: DocColumn): string {
  if (c.kind === "money" || c.kind === "num") return "end";
  if (c.kind === "check" || c.kind === "barcode") return "center";
  return "";
}

function cellHtml(value: Cell, col: DocColumn, lang: DocLang): string {
  if (value == null || value === "") return col.kind === "check" ? `<span class="check"></span>` : "";
  if (typeof value === "object" && "barcode" in value) return value.barcode ? code128Svg(value.barcode, { heightMm: 6, moduleMm: 0.22 }) : "";
  if (typeof value === "object" && "strong" in value) return `<strong>${tx(value.strong, lang)}</strong>`;
  if (isI18n(value)) return tx(value, lang);
  if (col.kind === "money" && typeof value === "number") return `<span class="money">${esc(money(value))}</span>`;
  if (col.kind === "num" || typeof value === "number") return `<span class="num">${esc(value)}</span>`;
  return esc(value);
}

function tableHtml(t: DocTable, lang: DocLang): string {
  const head = t.columns
    .map((c) => `<th class="${alignClass(c)}"${c.width ? ` style="width:${c.width}"` : ""}>${tx(c.label, lang)}${c.kind === "money" ? ` <span class="cur">(${txInline(L.currency, lang === "en" ? "en" : "ar")})</span>` : ""}</th>`)
    .join("");
  const body = t.rows.length
    ? t.rows
        .map((r) =>
          r.group
            ? `<tr class="group"><td colspan="${t.columns.length}">${tx(r.group, lang)}</td></tr>`
            : `<tr${r.muted ? ` class="muted"` : ""}>${t.columns.map((c) => `<td class="${alignClass(c)}">${cellHtml(r.cells[c.key], c, lang)}</td>`).join("")}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${t.columns.length}" class="empty">${tx(t.empty ?? L.noRows, lang)}</td></tr>`;
  return `${t.title ? `<h2>${tx(t.title, lang)}</h2>` : ""}<table class="lines"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Vollständiges HTML eines Dokuments (Inhalt; Kopf-/Fußzeilen über `headerFooter`) */
export async function renderDocumentHtml(doc: DocumentModel, lang: DocLang): Promise<string> {
  const c = doc.company;
  const dir = dirOf(lang);
  const htmlLang = lang === "en" ? "en" : "ar";
  const companyName =
    lang === "en" ? `<div class="name">${esc(c.nameEn)}</div>` : `<div class="name">${esc(c.nameAr)}</div>${lang === "bi" ? `<div class="name-en" dir="ltr">${esc(c.nameEn)}</div>` : ""}`;
  const address = lang === "en" ? esc(c.addressEn) : lang === "ar" ? esc(c.addressAr) : `${esc(c.addressAr)}<br><span dir="ltr">${esc(c.addressEn)}</span>`;
  const qr = doc.qr ? await qrSvg(doc.qr) : "";
  const parts: string[] = [];
  parts.push(`<header class="head">
  <div class="company">
    ${c.logoDataUrl ? `<img src="${esc(c.logoDataUrl)}" alt="">` : ""}
    <div>${companyName}
      <div class="small">${address}</div>
      <div class="small">${txInline(L.phone, lang)}: <span class="num">${esc(c.phone)}</span>${c.email ? ` · <span dir="ltr">${esc(c.email)}</span>` : ""}</div>
      <div class="small">${txInline(L.dealerNo, lang)}: <span class="num">${esc(c.dealerNumber)}</span>${c.taxFileNumber ? ` · ${txInline(L.taxFile, lang)}: <span class="num">${esc(c.taxFileNumber)}</span>` : ""}</div>
    </div>
  </div>
  <div class="doc-id">
    <div><h1>${tx(doc.title, lang)}</h1><div class="number num">${esc(doc.number)}</div>${doc.stamp ? `<div class="stamp">${txInline(doc.stamp, lang)}</div>` : ""}</div>
    ${qr}
  </div>
</header>`);
  if (doc.meta.length) {
    parts.push(
      `<section class="meta">${doc.meta.map((m) => `<div><div class="label">${tx(m.label, lang)}</div><div class="value">${isI18n(m.value) ? tx(m.value, lang) : `<span class="num">${esc(m.value)}</span>`}</div></div>`).join("")}</section>`,
    );
  }
  if (doc.parties?.length) {
    parts.push(`<section class="parties">${doc.parties.map((p) => `<div class="party"><div class="label">${tx(p.label, lang)}</div>${p.lines.filter(Boolean).map((l) => `<div>${tx(l, lang)}</div>`).join("")}</div>`).join("")}</section>`);
  }
  if (doc.intro?.length) parts.push(`<section class="intro">${doc.intro.map((p) => `<p>${tx(p, lang)}</p>`).join("")}</section>`);
  for (const t of doc.tables) parts.push(tableHtml(t, lang));
  if (doc.totals?.length) {
    parts.push(`<table class="totals">${doc.totals.map((t) => `<tr${t.strong ? ` class="strong"` : ""}><td>${tx(t.label, lang)}</td><td class="amount"><span class="money">${esc(money(t.amount))}</span> ${txInline(L.currency, lang === "en" ? "en" : "ar")}</td></tr>`).join("")}</table>`);
  }
  if (doc.notes?.length) parts.push(`<section class="notes">${doc.notes.map((n) => `<p>${tx(n, lang)}</p>`).join("")}</section>`);
  if (doc.signatures?.length) {
    parts.push(`<section class="signatures">${doc.signatures.map((s) => `<div class="sig">${tx(s, lang)}<div class="line">${txInline(L.name, lang)}: ________________ &nbsp; ${txInline(L.date, lang)}: ____________</div></div>`).join("")}</section>`);
  }
  return `<!doctype html><html lang="${htmlLang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(doc.number)}</title><style>${css(lang, !!doc.landscape)}</style></head><body class="doc-${esc(doc.kind.toLowerCase())}">${parts.join("\n")}</body></html>`;
}

/** Kopf-/Fußzeile (Chromium-Vorlagen): Firmenname + Nummer oben, Bankdaten + „Seite X von Y“ unten */
export function headerFooter(doc: DocumentModel, lang: DocLang): { headerTemplate: string; footerTemplate: string } {
  const dir = dirOf(lang);
  const base = `font-family:${FONT_STACK.replace(/"/g, "'")};font-size:7pt;color:#4b5563;width:100%;padding:0 ${PAGE_MARGIN.side};direction:${dir};display:flex;justify-content:space-between;gap:4mm;`;
  const style = `<style>${fontFaceCss()} .num{unicode-bidi:isolate;direction:ltr;}</style>`;
  const name = lang === "en" ? doc.company.nameEn : lang === "ar" ? doc.company.nameAr : `${doc.company.nameAr} · ${doc.company.nameEn}`;
  const banks = doc.showBanks === false ? [] : doc.company.banks;
  const bankLine = banks
    .map((b) => `${esc(lang === "en" ? b.bankNameEn : b.bankNameAr)}${b.branch ? ` (${esc(b.branch)})` : ""} – ${txInline(L.account, lang)} <span class="num">${esc(b.accountNo)}</span>${b.iban ? ` · IBAN <span class="num">${esc(b.iban)}</span>` : ""}`)
    .join(" | ");
  const pageLabel =
    lang === "bi"
      ? `<span dir="rtl">${esc(L.page.ar)} <span class="pageNumber num"></span> ${esc(L.of.ar)} <span class="totalPages num"></span></span> · <span dir="ltr">Page <span class="pageNumber num"></span> of <span class="totalPages num"></span></span>`
      : `${esc(L.page[lang])} <span class="pageNumber num"></span> ${esc(L.of[lang])} <span class="totalPages num"></span>`;
  return {
    headerTemplate: `${style}<div style="${base}"><span>${esc(name)}</span><span>${txInline(doc.title, lang)} <span class="num">${esc(doc.number)}</span></span></div>`,
    footerTemplate: `${style}<div style="${base}align-items:flex-end;"><span>${doc.footerText ? `${txInline(doc.footerText, lang)}<br>` : ""}${bankLine}</span><span style="white-space:nowrap">${pageLabel}</span></div>`,
  };
}
