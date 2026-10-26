"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/components/ui";
import type { AdminNavItem } from "./nav";

export function AdminSidebar({ items }: { items: AdminNavItem[] }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("menu")} className="space-y-0.5">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium",
              active ? "bg-brand-700 text-white" : "text-ink-200 hover:bg-ink-800 hover:text-white",
            )}
          >
            {t(item.key)}
            {item.plannedPhase ? <span className="num text-[10px] opacity-60">P{item.plannedPhase}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
