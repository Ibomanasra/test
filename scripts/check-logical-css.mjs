#!/usr/bin/env node
/**
 * RTL-Schutz: verbietet physische Richtungs-Utilities/Properties in UI-Code.
 * Erlaubt sind nur logische Varianten (ms-/me-/ps-/pe-/start-/end-/text-start/…).
 *   node scripts/check-logical-css.mjs   → Exit 1 bei Verstößen
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps/web/src", "packages/pdf/src"];
const EXT = /\.(tsx?|css|html)$/;

const TAILWIND = new RegExp(
  String.raw`(?<![\w-])-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-[\w\[./\]-]+|(?<![\w-])(text-left|text-right|float-left|float-right|clear-left|clear-right)(?![\w-])`,
  "g",
);
const CSS = /(?<![\w-])(margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align:\s*(left|right)|(?<![\w-])left\s*:|(?<![\w-])right\s*:)/g;

const STYLE_PROPS = /\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft\w*|borderRight\w*)\b|textAlign:\s*["'](left|right)["']/g;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.test(e)) yield p;
  }
}

const problems = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.includes("logical-css-ignore")) return;
      const re = file.endsWith(".css") ? CSS : TAILWIND;
      for (const m of line.matchAll(re)) problems.push(`${relative(process.cwd(), file)}:${i + 1}  ${m[0]}`);
      if (!file.endsWith(".css")) {
        for (const m of line.matchAll(CSS)) problems.push(`${relative(process.cwd(), file)}:${i + 1}  ${m[0]}`);
        for (const m of line.matchAll(STYLE_PROPS)) problems.push(`${relative(process.cwd(), file)}:${i + 1}  ${m[0]}`);
      }
    });
  }
}

if (problems.length) {
  console.error("Physische Richtungsangaben gefunden – bitte logische Varianten verwenden (ms-/me-/ps-/pe-/start-/end-):");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("logical-css: ok");
