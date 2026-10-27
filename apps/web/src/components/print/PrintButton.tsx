import { useTranslations } from "next-intl";
import { cn } from "@/components/ui";

function withParams(href: string, params: Record<string, string>) {
  const [path, query = ""] = href.split("?");
  const q = new URLSearchParams(query);
  for (const [k, v] of Object.entries(params)) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path!;
}

/**
 * „Drucken / PDF (A4)“: öffnet die Browser-Vorschau des PDFs in neuem Tab;
 * daneben Sprachvarianten (Englisch, zweisprachig) und Download.
 */
export function PrintButton({ href, label, className, testId }: { href: string; label?: string; className?: string; testId?: string }) {
  const t = useTranslations("print");
  const small = "px-2 py-1 text-xs text-ink-600 hover:bg-ink-100";
  return (
    <span className={cn("inline-flex items-stretch divide-x divide-ink-200 overflow-hidden rounded-lg ring-1 ring-ink-300 rtl:divide-x-reverse", className)}>
      <a href={href} target="_blank" rel="noopener" className="px-3 py-1 text-sm hover:bg-ink-100" data-testid={testId}>
        <span aria-hidden="true">🖨 </span>
        {label ?? t("button")}
      </a>
      <a href={withParams(href, { lang: "en" })} target="_blank" rel="noopener" className={small} title={t("english")}>EN</a>
      <a href={withParams(href, { lang: "bi" })} target="_blank" rel="noopener" className={small} title={t("bilingual")}>ع+EN</a>
      <a href={withParams(href, { download: "1" })} className={small} title={t("download")} aria-label={t("download")}>⬇</a>
    </span>
  );
}
