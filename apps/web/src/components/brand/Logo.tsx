import { cn } from "@/components/ui";

/**
 * Logo „شعلة الجنوب“ (Haus mit Kalligrafie) als Bild aus /public/brand.
 * - logo.png: dunkel auf transparent (helle Flächen)
 * - logo-light.png: weiß/rot auf transparent (dunkle Flächen, z. B. Admin-Seitenleiste)
 * - mark.png: nur Haus + rote Quadrate (Icons)
 * Seitenverhältnis des Logos 906 × 604.
 */
const RATIO = 906 / 604;

export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- statisches Markenbild, keine Optimierung nötig
  return <img src="/brand/mark.png" width={size} height={size} alt="" aria-hidden="true" className={cn("shrink-0 rounded-xl", className)} />;
}

/** Ganzes Logo; `size` = Höhe in px. Optional ein Untertitel (z. B. „لوحة الإدارة“) daneben. */
export function Logo({ tone = "light", size = 40, subtitle, className }: { tone?: "light" | "dark"; size?: number; subtitle?: string; className?: string }) {
  const dark = tone === "dark";
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- statisches Markenbild */}
      <img src={dark ? "/brand/logo-light.png" : "/brand/logo.png"} height={size} width={Math.round(size * RATIO)} alt="شعلة الجنوب – Sholat Aljanoub" className="shrink-0" style={{ height: size, width: "auto" }} />
      {subtitle ? <span className={cn("text-xs leading-tight", dark ? "text-ink-400" : "text-ink-600")}>{subtitle}</span> : null}
    </span>
  );
}
