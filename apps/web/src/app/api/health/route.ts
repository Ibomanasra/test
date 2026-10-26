import { prisma } from "@sa/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Health-Check für Docker/Load-Balancer: App läuft und DB antwortet. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok", time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
