import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Integrationstests laufen gegen eine eigene Datenbank (TEST_DATABASE_URL,
 * Standard: sa_test auf dem lokalen Docker-Postgres). Sie wird angelegt und migriert.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new PrismaClient({ datasourceUrl: admin.toString() });
  try {
    const rows = await client.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_database WHERE datname = ${dbName}`;
    if (rows[0]?.n === 0) await client.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.$disconnect();
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
