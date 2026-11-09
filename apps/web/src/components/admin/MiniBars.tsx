"use client";

import { useEffect, useRef, useState } from "react";

export interface MiniBar {
  key: string;
  /** Achsenbeschriftung (kurz) */
  label: string;
  value: number;
  /** Text beim Antippen/Hover, z. B. „12/11 · 34 زائر · 120 مشاهدة“ */
  tip: string;
}

/**
 * Einfaches Säulendiagramm (eine Reihe) mit Hover/Fokus-Anzeige und Tabellenansicht.
 * Linke Achse mit runden Schritten; Säulen mit 4px-Rundung oben, an der Grundlinie verankert.
 */
export function MiniBars({ data, title, table, labelEvery = 1, height = 200, testId }: { data: MiniBar[]; title: string; table: { label: string; value: string }; labelEvery?: number; height?: number; testId?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // echte Breite in Pixeln → Schrift bleibt auf Handy und PC gleich groß
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // auf schmalen Bildschirmen weniger Achsenbeschriftungen
  const every = W < 480 ? Math.max(labelEvery, Math.ceil(data.length / 6)) : labelEvery;
  const H = height;
  const pad = { top: 10, bottom: 26, side: 30 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = (() => {
    const raw = max / 3;
    const p = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
    return Math.max(1, [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw);
  })();
  const top = step * Math.ceil(max / step);
  const innerW = W - pad.side * 2;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / data.length;
  const barW = Math.max(3, Math.min(26, slot - 4));
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const h = hover != null ? data[hover] : null;
  const lastIdx = data.length - 1;

  return (
    <div ref={box} className="space-y-2" data-testid={testId}>
      <p className="min-h-5 text-sm text-ink-900" aria-live="polite">{h ? h.tip : <span className="text-ink-500">{title}</span>}</p>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label={title} style={{ direction: "ltr" }}>
        {[0, 1, 2, 3].map((i) => {
          const v = step * i;
          if (v > top) return null;
          return (
            <g key={i}>
              <line x1={pad.side} x2={W - pad.side} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={pad.side - 6} y={y(v) + 4} textAnchor="end" fontSize={12} fill="#6b7280">{v}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.side + slot * i + (slot - barW) / 2;
          const active = hover === i;
          const showLabel = (lastIdx - i) % every === 0;
          return (
            <g key={d.key} tabIndex={0} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => setHover(i)} className="cursor-default outline-none" aria-label={d.tip}>
              <rect x={pad.side + slot * i} y={pad.top} width={slot} height={innerH} fill={active ? "#f3f4f6" : "transparent"} />
              {d.value > 0 ? <path d={bar(x, y(d.value), barW, y(0) - y(d.value))} fill={active ? "#1d5fae" : "#2a78d6"} /> : null}
              {showLabel ? <text x={x + barW / 2} y={H - 7} textAnchor="middle" fontSize={12} fill={active ? "#111827" : "#6b7280"}>{d.label}</text> : null}
            </g>
          );
        })}
        <line x1={pad.side} x2={W - pad.side} y1={y(0)} y2={y(0)} stroke="#9ca3af" strokeWidth={1} />
      </svg>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-600 hover:text-ink-900">{table.label}</summary>
        <table className="mt-2 w-full text-sm">
          <tbody className="divide-y divide-ink-100">
            {data.map((d) => (
              <tr key={d.key}><td className="py-1">{d.tip.split(" · ")[0]}</td><td className="num py-1 text-end font-medium">{d.value}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Säule mit gerundeten oberen Ecken (4px), unten flach an der Grundlinie */
function bar(x: number, yTop: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${yTop + h}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yTop + h}Z`;
}
