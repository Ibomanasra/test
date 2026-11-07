import { getTranslations } from "next-intl/server";
import { cn } from "@/components/ui";

/** Fortschritt: Warenkorb → Lieferung & Zahlung → Fertig */
export async function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  const t = await getTranslations("shop.steps");
  const steps = [t("cart"), t("checkout"), t("done")];
  return (
    <ol className="mb-6 flex items-center gap-2 text-sm" aria-label={t("label")}>
      {steps.map((s, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const state = n < current ? "done" : n === current ? "now" : "next";
        return (
          <li key={s} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={state === "now" ? "step" : undefined}>
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", state === "done" ? "bg-green-600 text-white" : state === "now" ? "bg-ink-900 text-white" : "bg-ink-200 text-ink-500")}>
              {state === "done" ? "✓" : n}
            </span>
            <span className={cn("whitespace-nowrap", state === "now" ? "font-semibold text-ink-900" : "hidden text-ink-500 sm:inline")}>{s}</span>
            {n < 3 ? <span className={cn("h-0.5 flex-1 rounded", state === "done" ? "bg-green-600" : "bg-ink-200")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
