"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";

export function Pagination({ page, total, pageSize }: { page: number; total: number; pageSize: number }) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const search = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams(search.toString());
    qs.set("page", String(p));
    return `${pathname}?${qs.toString()}`;
  };
  return (
    <nav className="flex items-center justify-between text-sm">
      {page > 1 ? <Link href={href(page - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-ink-300">{t("previous")}</Link> : <span />}
      <span className="text-ink-600">{t("page", { page, pages })}</span>
      {page < pages ? <Link href={href(page + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-ink-300">{t("next")}</Link> : <span />}
    </nav>
  );
}
