import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { SOURCES, VISIT_COOKIE, isBot, recordVisit, sourceOf } from "@/server/services/visits";

const schema = z.object({
  path: z.string().min(1).max(300),
  q: z.string().max(200).optional(),
  ref: z.string().max(500).optional(),
  utm: z.string().max(60).optional(),
  entry: z.boolean().optional(),
  app: z.boolean().optional(),
  locale: z.string().max(5).optional(),
});

const ID = /^[a-f0-9-]{36}$/;

/** Seitenaufruf im Shop zählen (anonym). Antwort immer 204 – Fehler dürfen den Shop nie stören. */
export const POST = apiRoute(async (req) => {
  const res = new NextResponse(null, { status: 204 });
  const ua = req.headers.get("user-agent") ?? "";
  if (isBot(ua) || req.headers.get("sec-purpose")?.includes("prefetch")) return res;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return res;
  const auth = await getAuth();
  if (auth?.isStaff) return res; // Mitarbeiter nicht mitzählen
  let vid = req.cookies.get(VISIT_COOKIE)?.value;
  const isNew = !vid || !ID.test(vid);
  if (isNew) {
    vid = crypto.randomUUID();
    res.cookies.set(VISIT_COOKIE, vid, { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 400 * 86_400 });
  }
  const d = parsed.data;
  const path = d.path.split("?")[0]!.replace(/\/+$/, "") || "/";
  const slug = /^\/products\/([^/]+)$/.exec(path)?.[1] ?? null;
  let refHost: string | undefined;
  try {
    refHost = d.ref ? new URL(d.ref).host : undefined;
  } catch {
    refHost = undefined;
  }
  const source = d.entry ? sourceOf(d.utm, refHost, ua, req.headers.get("x-forwarded-host") ?? req.headers.get("host")) : null;
  await recordVisit(vid!, isNew, ua, {
    type: "view",
    path,
    slug: slug ? decodeURIComponent(slug) : null,
    query: path === "/products" ? d.q : null,
    entry: d.entry,
    source: source && (SOURCES as readonly string[]).includes(source) ? source : null,
    app: d.app,
    locale: d.locale,
  }).catch(() => undefined);
  return res;
});
