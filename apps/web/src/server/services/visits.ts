import "server-only";
import { businessDate, startOfBusinessDay } from "@sa/core";
import { Prisma, prisma } from "@sa/db";
import { hebronHour } from "./orders";

/**
 * Anonyme Besucherstatistik des Shops.
 * Besucher = zufällige ID im Cookie sa_vid (keine Namen, keine IP-Adressen gespeichert).
 * Mitarbeiter und Bots werden nicht gezählt.
 */

export const VISIT_COOKIE = "sa_vid";
export const SOURCES = ["whatsapp", "instagram", "facebook", "tiktok", "google", "telegram", "direct", "other"] as const;
export type VisitSource = (typeof SOURCES)[number];

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp\/|telegram(bot)?\/|curl|wget|python|node-fetch|axios|monitor|uptime/i;

export function isBot(ua: string | undefined | null): boolean {
  return !ua || BOT.test(ua);
}

export function deviceOf(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

/** Herkunft aus utm_source, Referrer-Host und In-App-Browser (Instagram/Facebook/TikTok öffnen Links im eigenen Browser) */
export function sourceOf(utm: string | undefined, refHost: string | undefined, ua: string, ownHost: string | null): VisitSource {
  const s = `${utm ?? ""} ${refHost ?? ""}`.toLowerCase();
  if (/whatsapp|wa\.me|\bwa\b/.test(s)) return "whatsapp";
  if (/instagram|\big\b/.test(s) || /instagram/i.test(ua)) return "instagram";
  if (/tiktok|bytedance/.test(s) || /musical_ly|tiktok|bytedancewebview/i.test(ua)) return "tiktok";
  if (/facebook|fb\.|\bfb\b|messenger/.test(s) || /FBAN|FBAV|FB_IAB|messenger/i.test(ua)) return "facebook";
  if (/telegram|t\.me/.test(s)) return "telegram";
  if (/google|bing|yahoo|duckduckgo|yandex/.test(s)) return "google";
  if (!refHost || (ownHost && refHost.replace(/^www\./, "") === ownHost.replace(/^www\.|:\d+$/g, ""))) return utm ? "other" : "direct";
  return "other";
}

export interface VisitInput {
  type: "view" | "cart" | "order";
  path: string;
  slug?: string | null;
  variantId?: string | null;
  query?: string | null;
  entry?: boolean;
  source?: VisitSource | null;
  app?: boolean;
  locale?: string | null;
}

export async function recordVisit(vid: string, isNew: boolean, ua: string, input: VisitInput) {
  const now = new Date();
  await prisma.visitEvent.create({
    data: {
      at: now,
      day: new Date(`${businessDate(now)}T00:00:00Z`),
      hour: hebronHour(now),
      vid,
      type: input.type,
      path: input.path.slice(0, 200),
      slug: input.slug?.slice(0, 160) ?? null,
      variantId: input.variantId?.slice(0, 40) ?? null,
      query: input.query ? input.query.trim().toLowerCase().slice(0, 80) || null : null,
      entry: !!input.entry,
      source: input.entry ? (input.source ?? "direct") : null,
      device: deviceOf(ua),
      app: !!input.app,
      locale: input.locale?.slice(0, 5) ?? null,
      isNew,
    },
  });
  // gelegentlich aufräumen: älter als 400 Tage
  if (Math.random() < 0.002) await prisma.visitEvent.deleteMany({ where: { at: { lt: new Date(now.getTime() - 400 * 86_400_000) } } });
}

/** Ereignis aus einer API-Anfrage zählen (Warenkorb, Bestellung) – nur Besucher mit Statistik-Cookie, nie Mitarbeiter */
export async function trackRequest(req: { cookies: { get(name: string): { value: string } | undefined }; headers: Headers }, isStaff: boolean, input: VisitInput) {
  const vid = req.cookies.get(VISIT_COOKIE)?.value;
  const ua = req.headers.get("user-agent") ?? "";
  if (!vid || isStaff || isBot(ua)) return;
  await recordVisit(vid, false, ua, input).catch(() => undefined);
}

export const VISIT_RANGES = [1, 7, 30, 90] as const;
export type VisitRange = (typeof VISIT_RANGES)[number];

const n = (v: unknown) => Number(v ?? 0);

/** Alle Zahlen für die Seite „Besucher“ */
export async function visitStats(days: VisitRange, locale: string) {
  const now = new Date();
  const todayYmd = businessDate(now);
  const fromYmd = businessDate(new Date(startOfBusinessDay(todayYmd).getTime() - (days - 1) * 86_400_000 + 12 * 3_600_000));
  const from = new Date(`${fromYmd}T00:00:00Z`);
  const fromStart = startOfBusinessDay(fromYmd);
  const W = Prisma.sql`"day" >= ${from}::date`;

  const [totals, online, daily, hours, funnel, sources, devices, locales, views, carts, searches, orders, signups] = await Promise.all([
    prisma.$queryRaw<{ visitors: bigint; views: bigint; new_visitors: bigint; app_visitors: bigint }[]>`
      SELECT COUNT(DISTINCT vid) AS visitors,
             COUNT(*) FILTER (WHERE type = 'view') AS views,
             COUNT(DISTINCT vid) FILTER (WHERE "isNew") AS new_visitors,
             COUNT(DISTINCT vid) FILTER (WHERE app) AS app_visitors
      FROM "VisitEvent" WHERE ${W}`,
    prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT vid) AS c FROM "VisitEvent" WHERE at > ${new Date(now.getTime() - 5 * 60_000)}`,
    prisma.$queryRaw<{ day: Date; visitors: bigint; views: bigint }[]>`
      SELECT "day", COUNT(DISTINCT vid) AS visitors, COUNT(*) FILTER (WHERE type = 'view') AS views
      FROM "VisitEvent" WHERE ${W} GROUP BY "day" ORDER BY "day"`,
    prisma.$queryRaw<{ hour: number; visitors: bigint }[]>`
      SELECT hour, COUNT(DISTINCT vid) AS visitors FROM "VisitEvent" WHERE ${W} GROUP BY hour`,
    prisma.$queryRaw<{ product: bigint; cart: bigint; checkout: bigint; ordered: bigint }[]>`
      SELECT COUNT(DISTINCT vid) FILTER (WHERE type = 'view' AND slug IS NOT NULL) AS product,
             COUNT(DISTINCT vid) FILTER (WHERE type = 'order') AS ordered,
             COUNT(DISTINCT vid) FILTER (WHERE type = 'cart') AS cart,
             COUNT(DISTINCT vid) FILTER (WHERE type = 'view' AND path LIKE '/checkout%') AS checkout
      FROM "VisitEvent" WHERE ${W}`,
    prisma.$queryRaw<{ source: string; visits: bigint; visitors: bigint }[]>`
      SELECT COALESCE(source, 'direct') AS source, COUNT(*) AS visits, COUNT(DISTINCT vid) AS visitors
      FROM "VisitEvent" WHERE ${W} AND entry GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw<{ device: string; visitors: bigint }[]>`
      SELECT COALESCE(device, 'mobile') AS device, COUNT(DISTINCT vid) AS visitors FROM "VisitEvent" WHERE ${W} GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw<{ locale: string; visitors: bigint }[]>`
      SELECT COALESCE(locale, 'ar') AS locale, COUNT(DISTINCT vid) AS visitors FROM "VisitEvent" WHERE ${W} GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw<{ slug: string; views: bigint; visitors: bigint }[]>`
      SELECT slug, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors FROM "VisitEvent"
      WHERE ${W} AND type = 'view' AND slug IS NOT NULL GROUP BY slug ORDER BY 2 DESC LIMIT 50`,
    prisma.$queryRaw<{ variantId: string; adds: bigint }[]>`
      SELECT "variantId", COUNT(*) AS adds FROM "VisitEvent" WHERE ${W} AND type = 'cart' AND "variantId" IS NOT NULL GROUP BY 1`,
    prisma.$queryRaw<{ query: string; c: bigint; visitors: bigint }[]>`
      SELECT query, COUNT(*) AS c, COUNT(DISTINCT vid) AS visitors FROM "VisitEvent" WHERE ${W} AND query IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    // Bestellungen aus dem Shop (Gast oder Kunde selbst, keine vom Personal angelegten)
    prisma.order.count({ where: { placedAt: { gte: fromStart }, isDemo: false, OR: [{ placedById: null }, { placedBy: { kind: "CUSTOMER" } }] } }),
    prisma.user.count({ where: { kind: "CUSTOMER", createdAt: { gte: fromStart } } }),
  ]);

  // Produktnamen + Warenkorb-Zahlen je Produkt
  const variantIds = carts.map((c) => c.variantId);
  const variants = variantIds.length ? await prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, product: { select: { slug: true } } } }) : [];
  const addsBySlug = new Map<string, number>();
  for (const c of carts) {
    const slug = variants.find((v) => v.id === c.variantId)?.product.slug;
    if (slug) addsBySlug.set(slug, (addsBySlug.get(slug) ?? 0) + n(c.adds));
  }
  const slugs = [...new Set([...views.map((v) => v.slug), ...addsBySlug.keys()])];
  const products = slugs.length
    ? await prisma.product.findMany({ where: { slug: { in: slugs } }, select: { slug: true, nameAr: true, nameEn: true, images: { select: { fileId: true }, orderBy: { sortOrder: "asc" }, take: 1 } } })
    : [];
  const name = (p: { nameAr: string; nameEn: string | null }) => (locale === "ar" ? p.nameAr : p.nameEn || p.nameAr);
  const topProducts = slugs
    .map((slug) => {
      const p = products.find((x) => x.slug === slug);
      const v = views.find((x) => x.slug === slug);
      return { slug, name: p ? name(p) : slug, imageId: p?.images[0]?.fileId ?? null, views: n(v?.views), visitors: n(v?.visitors), adds: addsBySlug.get(slug) ?? 0 };
    })
    .filter((r) => r.views > 0 || r.adds > 0)
    .sort((a, b) => b.views - a.views || b.adds - a.adds)
    .slice(0, 10);

  // lückenlose Tagesreihe
  const series: { day: string; visitors: number; views: number }[] = [];
  for (let i = 0; i < days; i++) {
    const ymd = businessDate(new Date(startOfBusinessDay(fromYmd).getTime() + i * 86_400_000 + 12 * 3_600_000));
    const d = daily.find((x) => x.day.toISOString().slice(0, 10) === ymd);
    series.push({ day: ymd, visitors: n(d?.visitors), views: n(d?.views) });
  }
  const t = totals[0];
  const visitors = n(t?.visitors);
  return {
    from: fromYmd,
    to: todayYmd,
    visitors,
    views: n(t?.views),
    newVisitors: n(t?.new_visitors),
    appVisitors: n(t?.app_visitors),
    online: n(online[0]?.c),
    orders,
    signups,
    /** Anteil der Besucher, die bestellt haben (nur gezählte Besucher) */
    conversionBps: visitors ? Math.round((n(funnel[0]?.ordered) / visitors) * 10_000) : 0,
    series,
    hours: Array.from({ length: 24 }, (_, h) => n(hours.find((x) => Number(x.hour) === h)?.visitors)),
    funnel: { visitors, product: n(funnel[0]?.product), cart: n(funnel[0]?.cart), checkout: n(funnel[0]?.checkout), orders: n(funnel[0]?.ordered) },
    sources: sources.map((s) => ({ source: s.source as VisitSource, visits: n(s.visits), visitors: n(s.visitors) })),
    devices: devices.map((d) => ({ device: d.device, visitors: n(d.visitors) })),
    locales: locales.map((d) => ({ locale: d.locale, visitors: n(d.visitors) })),
    topProducts,
    searches: searches.map((s) => ({ query: s.query, count: n(s.c), visitors: n(s.visitors) })),
  };
}
export type VisitStats = Awaited<ReturnType<typeof visitStats>>;
