import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Next.js 16 "proxy" (früher middleware): nur Sprach-Routing.
 * Authentifizierung und Rechte werden NICHT hier, sondern in jedem Layout,
 * jeder Seite und jedem API-Handler serverseitig geprüft.
 */
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|fonts|favicon.ico|robots.txt|.*\\..*).*)"],
};
