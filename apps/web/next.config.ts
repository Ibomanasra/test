import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Gemeinsame .env aus dem Projektordner laden (Monorepo). Bereits gesetzte Variablen
// (Docker, CI) haben Vorrang. Ersetzt die Verknüpfung apps/web/.env, die unter Windows scheitern kann.
const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo: Tracing ab Repo-Wurzel, damit packages/* im Standalone-Build landen
  // fileURLToPath statt .pathname: unter Windows wäre .pathname "/C:/…" (ungültig)
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  transpilePackages: ["@sa/core", "@sa/db", "@sa/contracts", "@sa/pdf"],
  serverExternalPackages: ["@node-rs/argon2", "@prisma/client", ".prisma/client", "playwright-core", "pdf-lib", "qrcode"],
  // playwright-core lädt browsers.json u. a. dynamisch – vollständig ins Standalone-Paket übernehmen (PDF-Druck)
  outputFileTracingIncludes: { "/**": ["../../node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**/*"] },
  poweredByHeader: false,
  typedRoutes: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
