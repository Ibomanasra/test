import { cn } from "@/components/ui";
import { FLAME_INNER, FLAME_OUTER } from "@/lib/brand";

/**
 * Markenzeichen „Glut“: Flamme auf dunkler Kachel (شعلة الجنوب = Flamme des Südens).
 * Dieselben Pfade nutzen Favicon (app/icon.svg), PDF-Standardlogo und App-Icon.
 */

export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cn("shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id="sa-logo-outer" x1=".2" y1="1" x2=".5" y2="0">
          <stop offset="0" stopColor="#9a3412" />
          <stop offset=".5" stopColor="#ea580c" />
          <stop offset="1" stopColor="#fbbf24" />
        </linearGradient>
        <linearGradient id="sa-logo-inner" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="1" stopColor="#fb923c" />
        </linearGradient>
        <radialGradient id="sa-logo-glow" cx=".5" cy=".75" r=".55">
          <stop offset="0" stopColor="#ea580c" stopOpacity=".35" />
          <stop offset="1" stopColor="#ea580c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#1c1917" />
      <rect width="64" height="64" rx="16" fill="url(#sa-logo-glow)" />
      <path d={FLAME_OUTER} fill="url(#sa-logo-outer)" />
      <path d={FLAME_INNER} fill="url(#sa-logo-inner)" />
    </svg>
  );
}

/** Zeichen + Wortmarke (Arabisch, darunter lateinisch gesperrt) */
export function Logo({ tone = "light", size = 40, subtitle, className }: { tone?: "light" | "dark"; size?: number; subtitle?: string; className?: string }) {
  const dark = tone === "dark";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-bold", size >= 40 ? "text-xl" : "text-lg", dark ? "text-white" : "text-ink-900")}>شعلة الجنوب</span>
        {subtitle ? (
          // eigener Untertitel (z. B. „لوحة الإدارة“): ohne Sperrung – sie würde arabische Buchstaben trennen
          <span className={cn("mt-1 text-xs", dark ? "text-ink-400" : "text-ink-600")}>{subtitle}</span>
        ) : (
          <span dir="ltr" className={cn("mt-1 text-[9px] font-semibold tracking-[0.3em] uppercase", dark ? "text-brand-300" : "text-brand-800")}>
            Sholat Aljanoub
          </span>
        )}
      </span>
    </span>
  );
}
