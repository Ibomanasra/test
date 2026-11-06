#!/usr/bin/env node
/**
 * Früher wurde die Root-.env nach apps/web/.env verlinkt bzw. kopiert. Next.js lädt die
 * Root-.env inzwischen selbst (apps/web/next.config.ts). Eine alte Verknüpfung oder Kopie
 * würde veraltete Werte liefern (unter Windows auch kaputte Links) → hier entfernen.
 */
import { lstatSync, readFileSync, unlinkSync } from "node:fs";

const target = "apps/web/.env";
try {
  const st = lstatSync(target);
  let ours = st.isSymbolicLink();
  if (!ours) {
    try {
      ours = readFileSync(target, "utf8").includes("Sholat Aljanoub – Umgebungsvariablen");
    } catch {
      ours = true;
    }
  }
  if (ours) {
    unlinkSync(target);
    console.log(`removed ${target} (Next.js liest jetzt direkt die .env im Projektordner)`);
  }
} catch {
  // nichts vorhanden
}
