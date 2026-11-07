"use client";

import { useEffect, useState } from "react";

/**
 * Abhaken beim Vorbereiten: merkt sich je Bestellung, welche Positionen schon geholt sind
 * (nur in diesem Browser – praktisch fürs Lager-Handy).
 */
export function PickCheck({ orderId, itemId, label }: { orderId: string; itemId: string; label: string }) {
  const key = `sa-pick:${orderId}`;
  const [done, setDone] = useState(false);
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- einmaliges Lesen aus localStorage nach dem Laden
      setDone(list.includes(itemId));
    } catch {
      /* Speicher nicht verfügbar */
    }
  }, [key, itemId]);
  const toggle = (v: boolean) => {
    setDone(v);
    try {
      const list = new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
      if (v) list.add(itemId);
      else list.delete(itemId);
      localStorage.setItem(key, JSON.stringify([...list]));
    } catch {
      /* Speicher nicht verfügbar */
    }
  };
  return (
    <label className="inline-flex cursor-pointer items-center" title={label}>
      <input type="checkbox" checked={done} onChange={(e) => toggle(e.target.checked)} className="size-6 accent-green-600" aria-label={label} data-testid="pick-check" />
    </label>
  );
}
