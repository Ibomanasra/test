"use client";

import { formatMoney } from "@sa/core";
import { useState } from "react";

export interface RevenueDay {
  day: string;
  B2C: number;
  B2B: number;
}

/**
 * Netto-Umsatz der letzten Tage als gestapelte Säulen (B2C unten, B2B oben).
 * Farben: geprüfte Kategorie-Slots 1/2 (Blau, Orange); Hover/Fokus zeigt die Werte,
 * die Tabellenansicht macht alles ohne Hover erreichbar.
 */
export function RevenueChart({ data, labels }: { data: RevenueDay[]; labels: { b2c: string; b2b: string; total: string; table: string; day: string } }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pad = { top: 12, bottom: 26, side: 46 };
  const max = Math.max(1, ...data.map((d) => d.B2C + d.B2B));
  // runde Achsenobergrenze (1-2-5-Schritte)
  const step = (() => {
    const raw = max / 3;
    const p = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw;
  })();
  const top = step * Math.ceil(max / step);
  const innerW = W - pad.side * 2;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(28, slot - 6);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const fmt = (a: number) => formatMoney(a, { symbol: false });
  const short = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
  const h = hover != null ? data[hover] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm text-ink-600">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm" style={{ background: "#2a78d6" }} />{labels.b2c}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm" style={{ background: "#eb6834" }} />{labels.b2b}</span>
        <span className="ms-auto min-h-5 text-ink-900" aria-live="polite">
          {h ? (
            <>
              <span className="num font-semibold">{fmt(h.B2C + h.B2B)} ₪</span> · <span className="num">{short(h.day)}</span> · {labels.b2c} <span className="num">{fmt(h.B2C)}</span> · {labels.b2b} <span className="num">{fmt(h.B2B)}</span>
            </>
          ) : null}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={labels.total} style={{ direction: "ltr" }}>
        {[0, 1, 2, 3].map((i) => {
          const v = (top / 3) * i;
          if (v > top) return null;
          return (
            <g key={i}>
              <line x1={pad.side} x2={W - pad.side} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={pad.side - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#6b7280">{v >= 100_000 ? `${Math.round(v / 100_000)}k` : Math.round(v / 100)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.side + slot * i + (slot - barW) / 2;
          const b2cTop = y(d.B2C);
          const b2bTop = y(d.B2C + d.B2B);
          const active = hover === i;
          return (
            <g
              key={d.day}
              tabIndex={0}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="cursor-default outline-none"
              aria-label={`${d.day}: ${fmt(d.B2C + d.B2B)}`}
            >
              {/* Trefferfläche größer als die Säule */}
              <rect x={pad.side + slot * i} y={pad.top} width={slot} height={innerH} fill={active ? "#f3f4f6" : "transparent"} />
              {d.B2C > 0 ? <rect x={x} y={b2cTop} width={barW} height={Math.max(0, y(0) - b2cTop)} rx={d.B2B > 0 ? 0 : 4} fill="#2a78d6" /> : null}
              {d.B2B > 0 ? <rect x={x} y={b2bTop} width={barW} height={Math.max(0, b2cTop - b2bTop - (d.B2C > 0 ? 2 : 0))} rx={4} fill="#eb6834" /> : null}
              {i % 2 === (data.length - 1) % 2 ? (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill={active ? "#111827" : "#6b7280"}>{short(d.day)}</text>
              ) : null}
            </g>
          );
        })}
        <line x1={pad.side} x2={W - pad.side} y1={y(0)} y2={y(0)} stroke="#9ca3af" strokeWidth={1} />
      </svg>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-600 hover:text-ink-900">{labels.table}</summary>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-ink-500"><th className="py-1 text-start font-medium">{labels.day}</th><th className="py-1 text-end font-medium">{labels.b2c}</th><th className="py-1 text-end font-medium">{labels.b2b}</th><th className="py-1 text-end font-medium">{labels.total}</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {[...data].reverse().map((d) => (
              <tr key={d.day}><td className="num py-1">{d.day}</td><td className="num py-1 text-end">{fmt(d.B2C)}</td><td className="num py-1 text-end">{fmt(d.B2B)}</td><td className="num py-1 text-end font-medium">{fmt(d.B2C + d.B2B)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
