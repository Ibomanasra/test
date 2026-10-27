import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { formatMoney } from "@sa/core";

/** Klassen zusammenführen; spätere Tailwind-Klassen überschreiben frühere (z. B. w-auto statt w-full). */
export function cn(...args: Parameters<typeof clsx>) {
  return twMerge(clsx(...args));
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300",
  secondary: "bg-white text-ink-800 ring-1 ring-ink-300 hover:bg-ink-100 disabled:text-ink-400",
  danger: "bg-red-700 text-white hover:bg-red-800 disabled:bg-red-300",
  ghost: "text-ink-700 hover:bg-ink-100",
};

export function Button({
  variant = "primary",
  className,
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

const fieldBase =
  "block w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-ink-100";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "pe-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-24", className)} {...props} />;
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-700">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink-200 sm:p-6", className)}>
      {title || actions ? (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-lg font-semibold">{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "brand";
const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700",
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
  brand: "bg-brand-100 text-brand-800",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone])}>{children}</span>;
}

export function Alert({ tone = "amber", children, "data-testid": testId }: { tone?: "amber" | "red" | "green" | "blue"; children: ReactNode; "data-testid"?: string }) {
  const map = {
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    red: "bg-red-50 text-red-800 ring-red-200",
    green: "bg-green-50 text-green-800 ring-green-200",
    blue: "bg-sky-50 text-sky-900 ring-sky-200",
  } as const;
  return (
    <div role={tone === "red" ? "alert" : "status"} className={cn("rounded-lg px-4 py-3 text-sm ring-1", map[tone])} data-testid={testId}>
      {children}
    </div>
  );
}

export function PageHeader({ title, actions, subtitle }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Betrag mit lateinischen Ziffern, LTR-isoliert, tabellarisch. */
export function Money({ agorot, className }: { agorot: number; className?: string }) {
  return <span className={cn("num", className)}>{formatMoney(agorot)}</span>;
}

/**
 * Zahlen, Nummern, Telefon, numerische Datumsangaben: LTR-isoliert, tabellarisch.
 * Intl fügt in "ar" Richtungsmarken (RLM/ALM) ein – die würden in LTR die Reihenfolge verdrehen.
 */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  const content = typeof children === "string" ? children.replace(/[\u200e\u200f\u061c]/g, "") : children;
  return <span className={cn("num", className)}>{content}</span>;
}

/** Datum/Zeit in Worten ("26 أكتوبر 2026") – natürliche Leserichtung der Sprache, nicht isoliert. */
export function DateText({ children }: { children: string }) {
  return <time className="tabular-nums">{children}</time>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-ink-200">
      <table className="min-w-full divide-y divide-ink-200 text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("bg-ink-50 px-4 py-3 text-start font-semibold whitespace-nowrap text-ink-600", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-top", className)}>{children}</td>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-white p-8 text-center text-ink-500 ring-1 ring-ink-200">{children}</p>;
}
