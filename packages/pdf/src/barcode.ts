/**
 * Code-128 (Zeichensatz B) als SVG – für SKU/EAN auf Kommissionierlisten und Etiketten.
 * Keine Abhängigkeit, deterministisch.
 */

// Balken-/Lückenbreiten je Symbolwert 0…106 (106 = Stopp, 7 Elemente)
export const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

const START_B = 104;
const STOP = 106;

export class BarcodeError extends Error {}

/** Symbolwerte inkl. Start, Prüfsumme und Stopp */
export function code128Values(text: string): number[] {
  if (!text) throw new BarcodeError("empty barcode");
  const values = [...text].map((ch) => {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) throw new BarcodeError(`unsupported character in barcode: ${JSON.stringify(ch)}`);
    return code - 32;
  });
  const checksum = values.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103;
  return [START_B, ...values, checksum, STOP];
}

/** SVG mit Ruhezone; Höhe/Modulbreite in mm */
export function code128Svg(text: string, opts: { moduleMm?: number; heightMm?: number; showText?: boolean } = {}): string {
  const module = opts.moduleMm ?? 0.25;
  const height = opts.heightMm ?? 8;
  const quiet = 10;
  let x = quiet;
  const bars: string[] = [];
  for (const v of code128Values(text)) {
    const pattern = CODE128_PATTERNS[v]!;
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]);
      if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="${height / module}"/>`);
      x += w;
    }
  }
  const width = x + quiet;
  const textH = opts.showText === false ? 0 : 3.2 / module;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="barcode" viewBox="0 0 ${width} ${height / module + textH}" ` +
    `width="${(width * module).toFixed(2)}mm" height="${(height + textH * module).toFixed(2)}mm" role="img" aria-label="${text.replace(/"/g, "")}">` +
    `<g fill="#000">${bars.join("")}</g>` +
    (textH ? `<text x="${width / 2}" y="${height / module + textH - 2}" font-size="${2.6 / module}" text-anchor="middle" font-family="monospace">${text.replace(/[<&]/g, "")}</text>` : "") +
    `</svg>`
  );
}
