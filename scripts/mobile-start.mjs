#!/usr/bin/env node
/**
 * Startet die Expo-App mit der Server-Adresse aus .env (APP_URL) –
 * funktioniert gleich unter Windows, macOS und Linux:  pnpm app
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
const appUrl = env.match(/^APP_URL=(.*)$/m)?.[1]?.trim() ?? "http://localhost:3000";
if (appUrl.includes("localhost")) console.warn("⚠ APP_URL zeigt auf localhost – das Handy erreicht den Rechner so nicht. In .env die IP des Rechners eintragen.");
console.log(`App verbindet sich mit: ${appUrl}\n`);
const r = spawnSync("pnpm", ["--filter", "@sa/mobile", "start"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, EXPO_PUBLIC_API_URL: appUrl },
});
process.exit(r.status ?? 0);
