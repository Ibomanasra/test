import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  transpilePackages: ["@sa/core", "@sa/db", "@sa/contracts"],
  serverExternalPackages: ["@node-rs/argon2", "@prisma/client", ".prisma/client"],
  poweredByHeader: false,
  typedRoutes: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
