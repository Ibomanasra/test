#!/usr/bin/env node
/**
 * Monorepo-Komfort: Next.js liest .env nur aus apps/web. Wir verlinken die
 * gemeinsame Root-.env dorthin (nur wenn vorhanden; in Docker/CI wird nichts getan).
 */
import { existsSync, lstatSync, symlinkSync } from "node:fs";

const target = "apps/web/.env";
if (!existsSync(".env")) process.exit(0);
try {
  lstatSync(target);
} catch {
  symlinkSync("../../.env", target);
  console.log(`linked ${target} → ../../.env`);
}
