"use client";

import { useRef, useState } from "react";
import { cn } from "@/components/ui";
import { ProductImage } from "./ProductImage";

/**
 * Mehrere Produktfotos zum Wischen (Scroll-Snap, funktioniert mit Finger und Maus, auch RTL).
 * „card“: kompakt mit Punkten; „page“: groß mit Pfeilen und Vorschaubildern.
 */
export function ImageCarousel({ imageIds, name, variant = "card", className }: { imageIds: string[]; name: string; variant?: "card" | "page"; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const ids = imageIds.length ? imageIds : [null];

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    // RTL: scrollLeft ist negativ – Betrag verwenden
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (i !== index) setIndex(Math.max(0, Math.min(ids.length - 1, i)));
  };
  const go = (i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    // nur die Leiste scrollen (nicht die Seite); in RTL zählt scrollLeft negativ
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollTo((rtl ? -1 : 1) * i * el.clientWidth, 0);
    setIndex(i);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <div
          ref={track}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-testid="image-carousel"
        >
          {ids.map((id, i) => (
            <div key={id ?? i} className="w-full shrink-0 snap-center" aria-hidden={i !== index}>
              <ProductImage imageId={id} name={name} className={variant === "page" ? "max-h-[28rem]" : undefined} />
            </div>
          ))}
        </div>
        {ids.length > 1 && variant === "page" ? (
          <>
            <button type="button" onClick={() => go(Math.max(0, index - 1))} disabled={index === 0} className="absolute start-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg shadow ring-1 ring-ink-200 disabled:opacity-0" aria-label="‹">
              <span className="rtl:-scale-x-100">‹</span>
            </button>
            <button type="button" onClick={() => go(Math.min(ids.length - 1, index + 1))} disabled={index === ids.length - 1} className="absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg shadow ring-1 ring-ink-200 disabled:opacity-0" aria-label="›">
              <span className="rtl:-scale-x-100">›</span>
            </button>
          </>
        ) : null}
        {ids.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5" data-testid="carousel-dots">
            {ids.map((_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-brand-700" : "w-1.5 bg-ink-400/60")} />
            ))}
          </div>
        ) : null}
      </div>
      {variant === "page" && ids.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ids.map((id, i) => (
            <button key={id ?? i} type="button" onClick={() => go(i)} className={cn("w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition", i === index ? "ring-brand-600" : "ring-transparent opacity-70 hover:opacity-100")} aria-label={`${i + 1}`} data-testid="carousel-thumb">
              <ProductImage imageId={id} name={name} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
