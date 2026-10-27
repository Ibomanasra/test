import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * IBM Plex Sans Arabic (OFL) wird als data:-URL in jedes Dokument eingebettet →
 * Chromium bettet die Schrift (Teilmenge) ins PDF ein, Arabisch wird korrekt verbunden.
 */

const WEIGHTS = [400, 500, 600, 700] as const;

const ARABIC_RANGE =
  "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC";
const LATIN_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

function fontsDir(): string {
  const candidates = [
    process.env.PDF_FONTS_DIR,
    path.join(process.cwd(), "packages/pdf/fonts"),
    path.join(process.cwd(), "../../packages/pdf/fonts"),
  ];
  try {
    candidates.push(fileURLToPath(new URL("../fonts", import.meta.url)));
  } catch {
    // gebündelt ohne file:-URL
  }
  const dir = candidates.find((d) => d && existsSync(path.join(d, "ibm-plex-sans-arabic-arabic-400-normal.woff2")));
  if (!dir) throw new Error("PDF fonts not found – set PDF_FONTS_DIR");
  return dir;
}

let cached: string | undefined;

/** @font-face-Regeln für Familie "SA Plex" */
export function fontFaceCss(): string {
  if (cached) return cached;
  const dir = fontsDir();
  const rules: string[] = [];
  for (const w of WEIGHTS) {
    for (const [subset, range] of [["latin", LATIN_RANGE], ["arabic", ARABIC_RANGE]] as const) {
      const data = readFileSync(path.join(dir, `ibm-plex-sans-arabic-${subset}-${w}-normal.woff2`)).toString("base64");
      rules.push(`@font-face{font-family:"SA Plex";font-style:normal;font-weight:${w};src:url(data:font/woff2;base64,${data}) format("woff2");unicode-range:${range};}`);
    }
  }
  cached = rules.join("\n");
  return cached;
}

export const FONT_STACK = `"SA Plex", "DejaVu Sans", sans-serif`;
