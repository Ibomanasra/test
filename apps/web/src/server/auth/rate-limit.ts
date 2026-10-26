import "server-only";
import { prisma } from "@sa/db";
import { tooManyRequests } from "../errors";

/**
 * Fixed-Window-Rate-Limit in Postgres (D5). Ein atomares UPSERT zählt hoch
 * bzw. startet ein neues Fenster. Wirft 429, wenn das Limit überschritten ist.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const rows = await prisma.$queryRaw<{ count: number; retry: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" <= now() - make_interval(secs => ${windowSeconds})
                     THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."windowStart" <= now() - make_interval(secs => ${windowSeconds})
                     THEN now() ELSE "RateLimitBucket"."windowStart" END
    RETURNING "count",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("windowStart" + make_interval(secs => ${windowSeconds}) - now()))))::int AS retry
  `;
  const row = rows[0];
  if (row && row.count > limit) throw tooManyRequests("rate_limited", row.retry);
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}
