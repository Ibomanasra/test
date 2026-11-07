import { NextResponse } from "next/server";

/** Web-App-Manifest je Bereich: Shop, Büro (Admin) und Fahrer starten jeweils an der richtigen Seite */
const AREAS = {
  shop: { name: "شعلة الجنوب", short: "شعلة الجنوب", start: "/ar" },
  admin: { name: "شعلة الجنوب – الإدارة", short: "الإدارة", start: "/ar/admin" },
  driver: { name: "شعلة الجنوب – السائق", short: "السائق", start: "/ar/driver" },
} as const;

export async function GET(_req: Request, { params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  const a = AREAS[area as keyof typeof AREAS] ?? AREAS.shop;
  return NextResponse.json(
    {
      id: a.start,
      name: a.name,
      short_name: a.short,
      start_url: a.start,
      scope: "/",
      display: "standalone",
      dir: "rtl",
      lang: "ar",
      background_color: "#ffffff",
      theme_color: "#c2410c",
      icons: [
        { src: "/brand/mark.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } },
  );
}
