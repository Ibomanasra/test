import "server-only";
import { headers } from "next/headers";

export interface RequestMeta {
  ip: string;
  userAgent: string | undefined;
  origin: string | null;
  host: string | null;
}

/** IP aus X-Forwarded-For (erster Eintrag, gesetzt vom Reverse-Proxy) bzw. X-Real-IP. */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || "0.0.0.0",
    userAgent: h.get("user-agent")?.slice(0, 300) ?? undefined,
    origin: h.get("origin"),
    host: h.get("x-forwarded-host") ?? h.get("host"),
  };
}
