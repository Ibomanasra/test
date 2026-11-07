import { getLocale, getTranslations } from "next-intl/server";
import { formatMoney } from "@sa/core";
import { cn } from "@/components/ui";
import type { ShopOffer } from "@/server/services/offers";

type OrderOffer = ShopOffer;

const STYLE: Record<OrderOffer["kind"], { emoji: string; bg: string }> = {
  WELCOME: { emoji: "🎁", bg: "from-violet-600 to-fuchsia-600" },
  CART_THRESHOLD: { emoji: "🛒", bg: "from-sky-600 to-blue-700" },
  COUPON: { emoji: "🏷️", bg: "from-emerald-600 to-teal-700" },
  FREE_DELIVERY: { emoji: "🚚", bg: "from-orange-500 to-red-600" },
};

/** Angebotskarten für Startseite und Angebotsseite */
export async function OfferBanners({ offers, compact = false }: { offers: OrderOffer[]; compact?: boolean }) {
  if (offers.length === 0) return null;
  const [t, locale] = await Promise.all([getTranslations("shop.offers"), getLocale()]);
  const ar = locale === "ar";
  const benefit = (o: OrderOffer) =>
    o.kind === "FREE_DELIVERY" ? t("freeDelivery") : o.percentBps ? t("percentOff", { pct: o.percentBps / 100 }) : t("amountOff", { amount: formatMoney(o.amountAgorot ?? 0) });
  return (
    <ul className={cn("grid gap-4", compact ? "sm:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2")} data-testid="offer-banners">
      {offers.map((o) => {
        const d = o.daysLeft;
        return (
          <li key={o.id} className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-md", STYLE[o.kind].bg)}>
            <span className="pointer-events-none absolute -end-4 -top-4 text-7xl opacity-20" aria-hidden="true">{STYLE[o.kind].emoji}</span>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/75">{t(`kind.${o.kind}`)}</p>
            <p className="mt-1 text-2xl font-extrabold">{benefit(o)}</p>
            <p className="mt-1 font-semibold">{ar ? o.nameAr : o.nameEn}</p>
            {(ar ? o.textAr : o.textEn) ? <p className="mt-1 text-sm text-white/90">{ar ? o.textAr : o.textEn}</p> : null}
            <p className="mt-2 text-xs text-white/85">
              {[
                o.kind === "WELCOME" ? t("firstOrder") : null,
                o.minOrderAgorot ? t("minOrder", { amount: formatMoney(o.minOrderAgorot) }) : null,
                d != null && d <= 14 ? (d <= 1 ? t("endsToday") : t("endsIn", { days: d })) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {o.kind === "COUPON" && o.code ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-white/70 bg-white/10 px-3 py-1">
                <span className="text-xs text-white/80">{t("useCode")}</span>
                <span className="font-mono text-lg font-bold tracking-widest" dir="ltr">{o.code}</span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
