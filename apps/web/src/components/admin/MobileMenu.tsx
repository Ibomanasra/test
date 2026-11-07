"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/components/ui";

/**
 * Handy-Menü der Verwaltung: Schublade von der Seite.
 * Schließt beim Antippen eines Links, beim Tippen daneben und mit Esc.
 */
export function MobileMenu({ label, closeLabel, children }: { label: string; closeLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // Seite dahinter nicht mitscrollen
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 ring-ink-300"
        data-testid="admin-menu"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        {label}
      </button>
      {/* Hintergrund */}
      <div className={cn("fixed inset-0 z-40 bg-black/40 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={() => setOpen(false)} aria-hidden="true" />
      {/* Schublade */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          "fixed inset-y-0 start-0 z-50 w-72 max-w-[85vw] overflow-y-auto bg-ink-900 p-4 shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full",
        )}
        // Antippen eines Menüpunkts schließt das Menü
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        <button type="button" onClick={() => setOpen(false)} className="absolute end-3 top-3 grid size-9 place-items-center rounded-lg text-ink-300 hover:bg-ink-800 hover:text-white" aria-label={closeLabel} data-testid="admin-menu-close">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        {open ? children : null}
      </div>
    </div>
  );
}
