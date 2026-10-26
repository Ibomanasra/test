"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/components/ui";

const TABS = [
  { href: "/admin/settings", key: "company" },
  { href: "/admin/settings/tax", key: "tax" },
  { href: "/admin/settings/zones", key: "zones" },
  { href: "/admin/settings/payment-methods", key: "paymentMethods" },
] as const;

export function SettingsTabs() {
  const t = useTranslations("admin.settings");
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-ink-200">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap", active ? "border-brand-700 text-brand-800" : "border-transparent text-ink-600 hover:text-ink-900")}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
