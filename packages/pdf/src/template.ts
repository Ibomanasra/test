import { formatMoney } from "@sa/core";
import { code128Svg } from "./barcode";
import { FONT_STACK, fontFaceCss } from "./fonts";
import { dirOf, esc, isI18n, tx, txInline } from "./html";
import { L } from "./labels";
import type { Cell, DocColumn, DocLang, DocTable, DocumentModel } from "./model";
import { qrSvg } from "./qr";

export const PAGE_MARGIN = { top: "15mm", side: "12mm", bottom: "18mm" } as const;

const money = (a: number) => formatMoney(a, { symbol: false });

/** Farben aus dem Firmenlogo: Anthrazit + Rot */
const INK = "#2f2f33";
const ACCENT = "#a8202c";
const TONES = {
  paid: { bg: "#ecfdf3", fg: "#047857", line: "#a7f3d0" },
  open: { bg: "#fff7ed", fg: "#9a3412", line: "#fed7aa" },
  partial: { bg: "#eff6ff", fg: "#1d4ed8", line: "#bfdbfe" },
  overdue: { bg: "#fef2f2", fg: "#b91c1c", line: "#fecaca" },
  info: { bg: "#f5f5f6", fg: INK, line: "#e5e7eb" },
  credit: { bg: "#f0fdfa", fg: "#0f766e", line: "#99f6e4" },
} as const;

function css(lang: DocLang, landscape: boolean): string {
  const tones = Object.entries(TONES)
    .map(([k, v]) => `.tone-${k}{background:${v.bg};border-color:${v.line};} .tone-${k} .amount,.pill.tone-${k},.totals tr.tone-${k} td{color:${v.fg};} .pill.tone-${k}{border-color:${v.line};}`)
    .join("\n");
  return `
${fontFaceCss()}
@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: ${PAGE_MARGIN.top} ${PAGE_MARGIN.side} ${PAGE_MARGIN.bottom}; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${FONT_STACK}; font-size: 9.5pt; line-height: 1.45; color: ${INK}; }
.num, .money { font-variant-numeric: tabular-nums; unicode-bidi: isolate; direction: ltr; }
.bi-ar { display: block; }
.bi-en { display: block; font-size: 0.82em; color: #6b7280; }
h2 { font-size: 10.5pt; margin: 5mm 0 2mm; color: ${INK}; }
/* Kopf */
.head { display: flex; justify-content: space-between; align-items: stretch; gap: 6mm; margin-bottom: 3mm; }
.company { display: flex; gap: 4mm; align-items: center; }
.company img { height: 24mm; max-width: 40mm; object-fit: contain; }
.company .name { font-size: 13pt; font-weight: 700; color: ${INK}; }
.company .name-en { font-size: 9.5pt; font-weight: 600; color: #4b5563; }
.company .small { font-size: 7.8pt; color: #4b5563; }
.doc-box { display: flex; gap: 3mm; align-items: center; background: #f5f5f6; border-radius: 3mm; padding: 3mm 4mm; border-inline-start: 2.5pt solid ${ACCENT}; }
.doc-box h1 { font-size: 15pt; margin: 0; color: ${ACCENT}; line-height: 1.2; }
.doc-box .number { font-size: 10.5pt; font-weight: 700; margin-top: 0.5mm; white-space: nowrap; }
.doc-box svg { width: 17mm; height: 17mm; }
.stamp { display: inline-block; margin-top: 1.5mm; border: 1.5pt solid #b91c1c; color: #b91c1c; padding: 0.3mm 3mm; font-weight: 700; font-size: 9pt; transform: rotate(-3deg); }
/* Eckdaten als Leiste */
.meta { display: grid; grid-template-columns: repeat(${landscape ? 6 : 4}, 1fr); gap: 0; margin: 0 0 4mm; border: 0.6pt solid #e5e7eb; border-radius: 2.5mm; overflow: hidden; }
.meta > div { padding: 1.8mm 3mm; border-inline-end: 0.6pt solid #e5e7eb; border-bottom: 0.6pt solid #e5e7eb; margin-bottom: -0.6pt; }
.meta .label { color: #6b7280; font-size: 7.5pt; }
.meta .value { font-weight: 600; font-size: 9pt; }
/* Großer Betrag + Status */
.summary { display: flex; justify-content: space-between; align-items: center; gap: 6mm; border: 0.8pt solid; border-radius: 3mm; padding: 2.5mm 5mm; margin-bottom: 3.5mm; break-inside: avoid; }
.summary .label { font-size: 9pt; font-weight: 600; }
.summary .amount { font-size: 18pt; font-weight: 800; line-height: 1.15; }
.summary .caption { font-size: 8.5pt; color: #4b5563; margin-top: 0.5mm; }
.pill { display: inline-block; border: 0.8pt solid; border-radius: 99mm; padding: 1mm 4mm; font-weight: 700; font-size: 10pt; background: #fff; white-space: nowrap; }
${tones}
/* Parteien */
.parties { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm; margin-bottom: 4mm; }
.party { border: 0.6pt solid #e5e7eb; border-radius: 2.5mm; padding: 2mm 3.5mm; break-inside: avoid; font-size: 8.8pt; line-height: 1.4; }
.party .label { color: ${ACCENT}; font-size: 7.5pt; font-weight: 700; margin-bottom: 1mm; text-transform: uppercase; letter-spacing: 0.02em; }
.party div:nth-child(2) { font-weight: 700; }
.intro p { margin: 0 0 2mm; }
/* Positionen */
table.lines { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 2mm; border: 0.6pt solid #e5e7eb; border-radius: 2.5mm; overflow: hidden; }
table.lines thead { display: table-header-group; }
table.lines th { background: ${INK}; color: #fff; font-size: 7.8pt; font-weight: 600; padding: 2mm 2mm; text-align: start; vertical-align: bottom; }
table.lines th .cur { color: #d1d5db; font-weight: 400; }
table.lines td { border-bottom: 0.4pt solid #eef0f2; padding: 1.8mm 2mm; vertical-align: top; white-space: pre-line; }
table.lines tbody tr:nth-child(even) td { background: #fafafa; }
table.lines tbody tr:last-child td { border-bottom: 0; }
table.lines tr { break-inside: avoid; page-break-inside: avoid; }
table.lines td.end, table.lines th.end { text-align: end; }
table.lines td.center, table.lines th.center { text-align: center; }
table.lines tr.group td { background: #fbeff0; font-weight: 600; }
table.lines tr.muted td { color: #9ca3af; }
table.lines td .barcode { display: block; }
table.lines .num, table.lines .money { white-space: nowrap; }
table.lines .item-main { font-weight: 600; }
table.lines .item-sub { font-size: 7.5pt; color: #6b7280; }
.check { display: inline-block; width: 4mm; height: 4mm; border: 0.8pt solid #374151; }
.empty { color: #6b7280; padding: 3mm 0; }
/* Summen + Zahlungshinweis nebeneinander */
.bottom { display: flex; gap: 5mm; align-items: flex-start; margin-top: 4mm; break-inside: avoid; }
.bottom .side { flex: 1; }
.totals { margin-inline-start: auto; width: ${landscape ? "40%" : "52%"}; border-collapse: separate; border-spacing: 0; background: #f5f5f6; border-radius: 2.5mm; overflow: hidden; }
.totals td { padding: 1.1mm 3mm; }
.totals td.amount { text-align: end; white-space: nowrap; }
.totals tr.strong td { font-weight: 800; font-size: 11.5pt; background: ${INK}; color: #fff; padding: 1.8mm 3mm; }
.totals tr.strong .bi-en { color: #d1d5db; }
.totals tr[class*="tone-"] td { font-weight: 700; background: transparent; }
.payinfo { border: 0.8pt dashed #9ca3af; border-radius: 2.5mm; padding: 2.5mm 3.5mm; font-size: 8.3pt; }
.payinfo .title { font-weight: 700; color: ${ACCENT}; margin-bottom: 1mm; }
.payinfo .bank { margin-top: 1.5mm; }
.payinfo .bank b { display: block; }
.notes { margin-top: 5mm; font-size: 8.3pt; color: #374151; break-inside: avoid; border-top: 0.6pt solid #e5e7eb; padding-top: 2mm; }
.notes p { margin: 0 0 1.5mm; white-space: pre-line; }
.thanks { margin-top: 6mm; text-align: center; font-weight: 700; color: ${ACCENT}; font-size: 10pt; }
/* zweisprachig kompakt: Englisch in derselben Zeile, wo Platz knapp ist */
.party .bi-ar, .party .bi-en, .totals .bi-ar, .totals .bi-en, .summary .caption .bi-ar, .summary .caption .bi-en, .notes .bi-ar, .notes .bi-en { display: inline; }
.party .bi-en::before, .totals .bi-en::before, .summary .caption .bi-en::before, .notes .bi-en::before { content: " · "; }
.signatures { display: flex; gap: 10mm; margin-top: 12mm; break-inside: avoid; }
.signatures .sig { flex: 1; border-top: 0.8pt solid ${INK}; padding-top: 1.5mm; font-size: 8.5pt; }
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
  if (typeof value === "object" && "main" in value) {
    const sub = value.sub == null || value.sub === "" ? "" : `<div class="item-sub">${isI18n(value.sub) ? tx(value.sub, lang) : `<span class="num">${esc(value.sub)}</span>`}</div>`;
    return `<div class="item-main">${tx(value.main, lang)}</div>${sub}`;
  }
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
  <div class="doc-box">
    <div><h1>${tx(doc.title, lang)}</h1><div class="number num">${esc(doc.number)}</div>${doc.stamp ? `<div class="stamp">${txInline(doc.stamp, lang)}</div>` : ""}</div>
    ${qr}
  </div>
</header>`);
  if (doc.meta.length) {
    parts.push(
      `<section class="meta">${doc.meta.map((m) => `<div><div class="label">${tx(m.label, lang)}</div><div class="value">${isI18n(m.value) ? tx(m.value, lang) : `<span class="num">${esc(m.value)}</span>`}</div></div>`).join("")}</section>`,
    );
  }
  if (doc.summary) {
    const sm = doc.summary;
    const tone = sm.tone ?? sm.status?.tone ?? "info";
    const caption = sm.caption ? `<div class="caption">${isI18n(sm.caption) ? tx(sm.caption, lang) : esc(sm.caption)}</div>` : "";
    parts.push(
      `<section class="summary tone-${tone}"><div><div class="label">${tx(sm.label, lang)}</div><div class="amount"><span class="money">${esc(money(sm.amount))}</span> ${txInline(L.currency, lang === "en" ? "en" : "ar")}</div>${caption}</div>${sm.status ? `<div class="pill tone-${sm.status.tone}">${txInline(sm.status.text, lang)}</div>` : ""}</section>`,
    );
  }
  if (doc.parties?.length) {
    parts.push(`<section class="parties">${doc.parties.map((p) => `<div class="party"><div class="label">${tx(p.label, lang)}</div>${p.lines.filter(Boolean).map((l) => `<div>${tx(l, lang)}</div>`).join("")}</div>`).join("")}</section>`);
  }
  if (doc.intro?.length) parts.push(`<section class="intro">${doc.intro.map((p) => `<p>${tx(p, lang)}</p>`).join("")}</section>`);
  for (const t of doc.tables) parts.push(tableHtml(t, lang));
  if (doc.totals?.length || doc.payInfo) {
    const totals = doc.totals?.length
      ? `<table class="totals">${doc.totals.map((t) => `<tr class="${[t.strong ? "strong" : "", t.tone ? `tone-${t.tone}` : ""].join(" ").trim()}"><td>${tx(t.label, lang)}</td><td class="amount"><span class="money">${esc(money(t.amount))}</span> ${txInline(L.currency, lang === "en" ? "en" : "ar")}</td></tr>`).join("")}</table>`
      : "";
    const pay = doc.payInfo
      ? `<div class="payinfo"><div class="title">${tx(doc.payInfo.title, lang)}</div>${doc.payInfo.text ? `<div>${tx(doc.payInfo.text, lang)}</div>` : ""}${c.banks
          .map(
            (bk) =>
              `<div class="bank"><b>${esc(lang === "en" ? bk.bankNameEn : bk.bankNameAr)}${bk.branch ? ` – ${esc(bk.branch)}` : ""}</b>${txInline(L.accountName, lang)}: ${esc(bk.accountName)}<br>${txInline(L.accountNo, lang)}: <span class="num">${esc(bk.accountNo)}</span>${bk.iban ? `<br>IBAN: <span class="num">${esc(bk.iban)}</span>` : ""}${bk.swift ? ` · SWIFT: <span class="num">${esc(bk.swift)}</span>` : ""}</div>`,
          )
          .join("")}</div>`
      : "";
    parts.push(`<section class="bottom">${pay ? `<div class="side">${pay}</div>` : ""}${totals}</section>`);
  }
  if (doc.notes?.length) parts.push(`<section class="notes">${doc.notes.map((n) => `<p>${tx(n, lang)}</p>`).join("")}</section>`);
  if (doc.thanks) parts.push(`<p class="thanks">${txInline(doc.thanks, lang)}</p>`);
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
