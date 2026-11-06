"use client";

import { useEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/components/ui";

type Tab = { href: string; label: string };

/** Unterreiter; selten genutzte Reiter optional hinter „mehr“ (`more`) */
export function SubTabs({ tabs, more, moreLabel }: { tabs: Tab[]; more?: Tab[]; moreLabel?: string }) {
  const pathname = usePathname();
  const all = [...tabs, ...(more ?? [])];
  // längster passender Pfad ist aktiv
  const active = [...all].sort((a, b) => b.href.length - a.href.length).find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href;
  const activeMore = more?.find((t) => t.href === active);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [pathname]);
  const cls = (on: boolean) =>
    cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap", on ? "border-brand-700 text-brand-800" : "border-transparent text-ink-600 hover:text-ink-900");
  return (
    <nav className="relative mb-6 flex gap-1 border-b border-ink-200">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={active === tab.href ? "page" : undefined} className={cls(active === tab.href)}>
            {tab.label}
          </Link>
        ))}
      </div>
      {more?.length ? (
        <details ref={details} className="group relative">
          <summary className={cn(cls(Boolean(activeMore)), "flex cursor-pointer list-none items-center gap-1")} data-testid="subtabs-more">
            {activeMore ? activeMore.label : moreLabel}
            <svg viewBox="0 0 20 20" className="size-4 transition group-open:rotate-180" fill="currentColor" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </summary>
          <div className="absolute end-0 z-20 mt-1 min-w-52 rounded-xl bg-white p-1 shadow-lg ring-1 ring-ink-200">
            {more.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active === tab.href ? "page" : undefined}
                className={cn("block rounded-lg px-3 py-2 text-sm", active === tab.href ? "bg-brand-50 font-medium text-brand-800" : "text-ink-700 hover:bg-ink-50")}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </nav>
  );
}
