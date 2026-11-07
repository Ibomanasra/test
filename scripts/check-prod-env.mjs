#!/usr/bin/env node
// Prüft die .env vor dem Produktionsstart. Fehler = Start abbrechen, Warnung = bitte bald erledigen.
//   node scripts/check-prod-env.mjs
import { existsSync, readFileSync } from "node:fs";

if (!existsSync(".env")) {
  console.error("✗ .env fehlt – zuerst scripts/server-install.sh ausführen.");
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"(.*)"$/, "$1")];
    }),
);
const errors = [];
const warnings = [];
const err = (ok, msg) => !ok && errors.push(msg);
const warn = (ok, msg) => !ok && warnings.push(msg);

err(env.NODE_ENV === "production", "NODE_ENV muss production sein");
err(!!env.DOMAIN, "DOMAIN fehlt (z. B. sholataljanoub.ps)");
err(env.APP_URL === `https://${env.DOMAIN}`, `APP_URL muss https://${env.DOMAIN} sein`);
err(env.COOKIE_SECURE === "true", "COOKIE_SECURE muss true sein");
err((env.SESSION_SECRET ?? "").length >= 32 && !env.SESSION_SECRET.startsWith("change-me"), "SESSION_SECRET: mindestens 32 zufällige Zeichen");
err(env.POSTGRES_PASSWORD && env.POSTGRES_PASSWORD !== "sa_dev_password", "POSTGRES_PASSWORD: eigenes, langes Passwort setzen");
err(env.S3_SECRET_KEY && env.S3_SECRET_KEY !== "sa_minio_secret", "S3_SECRET_KEY: eigenes, langes Passwort setzen");
err(!env.OTP_DEV_FIXED_CODE, "OTP_DEV_FIXED_CODE muss leer sein (sonst kann sich jeder mit 123456 anmelden)");
err(env.SEED_OWNER_PASSWORD && env.SEED_OWNER_PASSWORD !== "ChangeMe!2026" && env.SEED_OWNER_PASSWORD.length >= 10, "SEED_OWNER_PASSWORD: eigenes Passwort (mind. 10 Zeichen)");
err(env.SEED_OWNER_PHONE && env.SEED_OWNER_PHONE !== "+970599000001", "SEED_OWNER_PHONE: deine echte Handynummer (+970… oder +972…)");
err((env.COMPOSE_FILE ?? "").includes("docker-compose.prod.yml"), "COMPOSE_FILE muss docker-compose.yml:docker-compose.prod.yml enthalten");

warn(env.SEED_DEMO_DATA === "false", "SEED_DEMO_DATA=true – Demo-Kunden und -Produkte würden angelegt");
warn(
  (env.SMS_PROVIDER === "twilio" && !!env.TWILIO_ACCOUNT_SID && !!env.TWILIO_AUTH_TOKEN && !!env.TWILIO_FROM) || (env.SMS_PROVIDER === "http" && !!env.SMS_API_URL),
  "SMS ist nicht eingerichtet – Kunden bekommen KEINEN Login-Code (Twilio-Daten in .env eintragen, siehe VEROEFFENTLICHEN.md)",
);
warn(env.PAYMENT_GATEWAY !== "fake", "PAYMENT_GATEWAY=fake – Kartenzahlung im Admin unter Zahlungsarten ausschalten oder echten Anbieter eintragen");
warn(env.SMTP_HOST && !["localhost", "mailpit"].includes(env.SMTP_HOST), "SMTP_HOST fehlt – „Passwort vergessen“ für Mitarbeiter funktioniert nicht");

for (const w of warnings) console.log(`⚠ ${w}`);
for (const e of errors) console.error(`✗ ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} Fehler – bitte .env korrigieren (nano .env) und erneut prüfen.`);
  process.exit(1);
}
console.log(warnings.length ? "\n✓ Startbereit (mit Hinweisen oben)." : "✓ Alles bereit für den Start.");
