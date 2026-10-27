"use client";

import { parseShekel } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

/** Unterschriftsfeld (Canvas, Finger/Maus) → PNG-data:-URL */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const t = useTranslations("driver");
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * e.currentTarget.width) / r.width, y: ((e.clientY - r.top) * e.currentTarget.height) / r.height };
  };
  return (
    <div>
      <canvas
        ref={ref}
        width={600}
        height={200}
        className="h-32 w-full touch-none rounded-lg bg-white ring-1 ring-ink-300"
        aria-label={t("signature")}
        onPointerDown={(e) => {
          drawing.current = true;
          const c = e.currentTarget.getContext("2d")!;
          const p = pos(e);
          c.lineWidth = 3;
          c.lineCap = "round";
          c.beginPath();
          c.moveTo(p.x, p.y);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const c = e.currentTarget.getContext("2d")!;
          const p = pos(e);
          c.lineTo(p.x, p.y);
          c.stroke();
          dirty.current = true;
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          if (dirty.current) onChange(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <button
        type="button"
        className="mt-1 text-xs text-ink-600 underline"
        onClick={() => {
          const c = ref.current;
          c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
          dirty.current = false;
          onChange(null);
        }}
      >
        {t("clearSignature")}
      </button>
    </div>
  );
}

export function DriverStop({ stopId, codExpected, codLabel }: { stopId: string; codExpected: number; codLabel: string }) {
  const t = useTranslations("driver");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const [mode, setMode] = useState<"idle" | "deliver" | "fail">("idle");
  const [name, setName] = useState("");
  const [cash, setCash] = useState(codExpected ? (codExpected / 100).toFixed(2) : "");
  const [signature, setSignature] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function deliver() {
    let cashAmount = 0;
    try {
      cashAmount = cash.trim() ? parseShekel(cash) : 0;
    } catch {
      setError(t("invalidAmount"));
      return;
    }
    if (await call(`/api/v1/driver/stops/${stopId}/deliver`, { body: { receivedByName: name || undefined, cashAmount, signature: signature ?? undefined }, locale })) router.refresh();
  }

  async function fail() {
    if (await call(`/api/v1/driver/stops/${stopId}/fail`, { body: { reason }, locale })) router.refresh();
  }

  if (mode === "idle") {
    return (
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setMode("deliver")} data-testid="stop-deliver">{t("delivered")}</Button>
        <Button className="flex-1" variant="secondary" onClick={() => setMode("fail")} data-testid="stop-fail">{t("failed")}</Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {mode === "deliver" ? (
        <>
          <Field label={t("receivedBy")} htmlFor={`rb-${stopId}`}><Input id={`rb-${stopId}`} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          {codExpected > 0 ? (
            <Field label={`${t("cashCollected")} (${codLabel})`} htmlFor={`cash-${stopId}`}>
              <Input id={`cash-${stopId}`} inputMode="decimal" dir="ltr" className="num" value={cash} onChange={(e) => setCash(e.target.value)} />
            </Field>
          ) : null}
          <SignaturePad onChange={setSignature} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void deliver()} disabled={pending} data-testid="confirm-deliver">{t("confirm")}</Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>{t("back")}</Button>
          </div>
        </>
      ) : (
        <>
          <Field label={t("failReason")} htmlFor={`fr-${stopId}`}><Input id={`fr-${stopId}`} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="flex gap-2">
            <Button className="flex-1" variant="danger" onClick={() => void fail()} disabled={pending || reason.trim().length < 3} data-testid="confirm-fail">{t("confirm")}</Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>{t("back")}</Button>
          </div>
        </>
      )}
      {error ? <Alert tone="red">{error}</Alert> : null}
    </div>
  );
}

const DENOMS = [20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50, 10];

/** Kassenabschluss: Stückelung zählen → Summe, Abgabe */
export function CashClosingForm({ expected }: { expected: number }) {
  const t = useTranslations("driver");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ difference: number } | null>(null);
  const total = DENOMS.reduce((a, d) => a + d * (Number(counts[d]) || 0), 0);
  const fmt = (a: number) => (a / 100).toFixed(2);
  async function submit() {
    const denominations = Object.fromEntries(DENOMS.map((d) => [String(d), Number(counts[d]) || 0]));
    const res = await call<{ difference: number }>("/api/v1/driver/cash-closing", { body: { denominations }, locale });
    if (res) {
      setDone(res);
      router.refresh();
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {DENOMS.map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm">
            <span className="num w-16 text-end">{fmt(d)}</span>×
            <Input type="number" min={0} dir="ltr" className="num" value={counts[d] ?? ""} onChange={(e) => setCounts({ ...counts, [d]: e.target.value })} aria-label={fmt(d)} />
          </label>
        ))}
      </div>
      <p className="text-sm">{t("countedTotal")}: <span className="num font-semibold">{fmt(total)}</span> · {t("expected")}: <span className="num">{fmt(expected)}</span> · {t("difference")}: <span className={`num font-semibold ${total - expected ? "text-red-700" : "text-green-700"}`}>{fmt(total - expected)}</span></p>
      <Button className="w-full" onClick={() => void submit()} disabled={pending} data-testid="submit-closing">{t("submitClosing")}</Button>
      {done ? <Alert tone={done.difference ? "amber" : "green"}>{t("closingSubmitted")}</Alert> : null}
      {error ? <Alert tone="red">{error}</Alert> : null}
    </div>
  );
}
