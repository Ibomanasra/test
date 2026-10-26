"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/components/ui";

export function SubTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // längster passender Pfad ist aktiv
  const active = [...tabs].sort((a, b) => b.href.length - a.href.length).find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href;
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-ink-200">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={active === tab.href ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
            active === tab.href ? "border-brand-700 text-brand-800" : "border-transparent text-ink-600 hover:text-ink-900",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
