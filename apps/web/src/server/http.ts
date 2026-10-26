import "server-only";
import { Prisma } from "@sa/db";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, badRequest, forbidden } from "./errors";

type RouteContext<P> = { params: Promise<P> };

/**
 * Einheitlicher Wrapper für alle /api/v1-Handler:
 *  - CSRF-Schutz: Schreibende Requests mit Cookie-Session müssen vom eigenen Origin kommen
 *  - Fehler → JSON { error: { code, details } } mit passendem HTTP-Status
 *  - Antworten sind nie cachebar (Preise/Personendaten)
 */
export function apiRoute<P = Record<string, string>>(
  handler: (req: NextRequest, ctx: RouteContext<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const result = await handler(req, ctx);
      const res = result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (err) {
      return errorResponse(err);
    }
  };
}

function assertSameOrigin(req: NextRequest): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin) {
    // Browser senden bei fetch/POST immer Origin; ohne Origin nur ohne Cookie zulassen (z. B. curl/Tests)
    if (req.cookies.size > 0 && req.cookies.has("sa_session")) throw forbidden("csrf");
    return;
  }
  try {
    if (new URL(origin).host !== host) throw forbidden("csrf");
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw forbidden("csrf");
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    const res = NextResponse.json({ error: { code: err.code, details: err.details } }, { status: err.status });
    const retry = (err.details as { retryAfter?: number } | undefined)?.retryAfter;
    if (retry) res.headers.set("Retry-After", String(retry));
    return res;
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_error", details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } },
      { status: 400 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return NextResponse.json({ error: { code: "duplicate", details: err.meta } }, { status: 409 });
    if (err.code === "P2025") return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: { code: "internal_error" } }, { status: 500 });
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("invalid_json");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}
