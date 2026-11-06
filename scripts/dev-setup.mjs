#!/usr/bin/env node
/**
 * Einrichtung für den lokalen Test (Windows, macOS, Linux) – ein Befehl:
 *   pnpm setup:dev
 *
 *  1. .env für die Entwicklung anlegen (fester SMS-Code 123456, Zufalls-Secret, IP des Rechners)
 *  2. Datenbank, Dateispeicher und Mailpit in Docker starten
 *  3. Chromium für die PDF-Erzeugung installieren
 *  4. Datenbank anlegen, Demo-Daten und Beispielbestellungen einspielen
 * Mehrfach ausführbar; eine vorhandene .env wird nicht überschrieben.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const isWin = process.platform === "win32";
const step = (n, text) => console.log(`\n\x1b[1m[${n}/5] ${text}\x1b[0m`);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: isWin, ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    console.error(`\n✖ Befehl fehlgeschlagen: ${cmd} ${args.join(" ")}`);
    process.exit(1);
  }
  return r.status === 0;
}

/** IP des Rechners im WLAN/LAN (virtuelle Adapter von Docker/WSL/VMs werden übersprungen) */
function lanIp() {
  const virtual = /docker|br-|veth|vethernet|wsl|virtualbox|vmware|vbox|utun|tailscale|zerotier/i;
  const found = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (virtual.test(name)) continue;
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) found.push(a.address);
  }
  const rank = (ip) => (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : 2);
  return found.sort((a, b) => rank(a) - rank(b))[0] ?? "localhost";
}

function setVar(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(text) ? text.replace(re, `${key}=${value}`) : `${text}\n${key}=${value}\n`;
}

// 1 ── .env ──────────────────────────────────────────────────────────────────
step(1, "Konfiguration (.env)");
const ip = lanIp();
if (!existsSync(".env")) {
  let env = readFileSync(".env.example", "utf8");
  env = setVar(env, "NODE_ENV", "development");
  env = setVar(env, "OTP_DEV_FIXED_CODE", "123456");
  env = setVar(env, "SESSION_SECRET", randomBytes(36).toString("base64url"));
  env = setVar(env, "APP_URL", `http://${ip}:3000`);
  env = setVar(env, "PAYMENT_GATEWAY", "fake");
  writeFileSync(".env", env);
  console.log(`✓ .env angelegt (Adresse für Handy: http://${ip}:3000, SMS-Code immer 123456)`);
} else {
  console.log("✓ .env existiert bereits – unverändert");
}
// alte apps/web/.env (Verknüpfung/Kopie) entfernen – Next.js liest die Root-.env direkt
spawnSync(process.execPath, ["scripts/link-env.mjs"], { stdio: "inherit" });

// 2 ── Docker ────────────────────────────────────────────────────────────────
step(2, "Datenbank, Dateispeicher und Mailpit starten (Docker)");
if (!run("docker", ["info"], { stdio: "ignore", allowFail: true })) {
  console.error("✖ Docker läuft nicht. Bitte Docker Desktop starten und warten, bis es „running“ meldet. Dann erneut: pnpm setup:dev");
  process.exit(1);
}
run("docker", ["compose", "up", "-d", "postgres", "minio", "mailpit"]);
process.stdout.write("Warte auf die Datenbank ");
for (let i = 0; i < 60; i++) {
  const r = spawnSync("docker", ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "sa"], { stdio: "ignore", shell: isWin });
  if (r.status === 0) break;
  process.stdout.write(".");
  spawnSync(process.execPath, ["-e", "setTimeout(()=>{},1000)"]);
}
console.log(" ✓");

// 3 ── Chromium ──────────────────────────────────────────────────────────────
step(3, "Chromium für PDFs installieren (einmalig, ca. 150 MB)");
run("pnpm", ["exec", "playwright", "install", "chromium"]);

// 4 ── Datenbank ─────────────────────────────────────────────────────────────
step(4, "Datenbank anlegen und Demo-Daten einspielen");
run("pnpm", ["db:deploy"]);
run("pnpm", ["db:seed"]);

step(5, "Beispielbestellungen in allen Status");
run("pnpm", ["db:demo-orders"]);

console.log(`
\x1b[32m✓ Fertig.\x1b[0m Jetzt den Server starten:

    pnpm dev

Dann im Browser:
    Shop    http://localhost:3000/ar
    Admin   http://localhost:3000/ar/admin     (0599000001 / ChangeMe!2026, Code 123456)
    E-Mails http://localhost:8025

Handy-App (zweites Fenster):  pnpm app
`);
