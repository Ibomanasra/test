"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/components/ui";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlB64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function detect(): Promise<State> | State {
  if (typeof window === "undefined") return "loading";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => reg.pushManager.getSubscription())
    .then((sub): State => (sub && Notification.permission === "granted" ? "on" : "off"))
    .catch((): State => "unsupported");
}

/**
 * Schalter „Benachrichtigungen auf diesem Gerät“.
 * compact: kleine Variante für die Kopfzeile.
 */
export function PushToggle({ compact = false, hideWhenOn = false }: { compact?: boolean; hideWhenOn?: boolean }) {
  const t = useTranslations("push");
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.resolve(detect()).then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await apiFetch<{ publicKey: string }>("/api/v1/me/web-push");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) }));
      await apiFetch("/api/v1/me/web-push", { body: sub.toJSON() });
      setState("on");
      await apiFetch("/api/v1/me/web-push/test", { method: "POST" });
    } catch {
      setMsg(t("failed"));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiFetch(`/api/v1/me/web-push?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiFetch<{ sent: number }>("/api/v1/me/web-push/test", { method: "POST" });
      setMsg(r.sent ? t("testSent") : t("failed"));
    } catch {
      setMsg(t("failed"));
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading" || state === "unsupported") return null;
  if (hideWhenOn && state === "on" && !msg) return null;

  if (compact) {
    if (state === "on") return <span className="hidden text-xs text-emerald-700 sm:inline" data-testid="push-on" title={t("on")}>🔔</span>;
    if (state !== "off") return null;
    return (
      <button type="button" onClick={() => void enable()} disabled={busy} data-testid="push-enable-compact" className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200">
        🔔 {t("enableShort")}
      </button>
    );
  }

  return (
    <div className={cn("rounded-xl border p-3 text-sm", state === "on" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")} data-testid="push-card">
      {state === "on" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-emerald-800">🔔 {t("on")}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void test()} disabled={busy} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-emerald-200" data-testid="push-test">{t("test")}</button>
            <button type="button" onClick={() => void disable()} disabled={busy} className="rounded-lg px-3 py-1.5 text-xs text-ink-600 underline">{t("disable")}</button>
          </div>
        </div>
      ) : state === "off" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-amber-900">🔕 {t("offTitle")}</p>
            <p className="text-xs text-amber-800">{t("offText")}</p>
          </div>
          <button type="button" onClick={() => void enable()} disabled={busy} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800" data-testid="push-enable">{t("enable")}</button>
        </div>
      ) : state === "denied" ? (
        <p className="text-amber-900">🔕 {t("denied")}</p>
      ) : (
        <div>
          <p className="font-medium text-amber-900">📲 {t("iosTitle")}</p>
          <p className="text-xs text-amber-800">{t("iosText")}</p>
        </div>
      )}
      {msg ? <p className="mt-2 text-xs text-ink-700">{msg}</p> : null}
    </div>
  );
}
