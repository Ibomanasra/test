import { ORDER_STATUSES, statusStep, type OrderStatusKey } from "@sa/core";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui";

export function OrderStatusTimeline({ status, events }: { status: OrderStatusKey; events: { toStatus: string; at: string }[] }) {
  const t = useTranslations("orderStatus");
  if (status === "CANCELLED") return <p className="font-semibold text-red-700">{t("CANCELLED")}</p>;
  const current = statusStep(status);
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" data-testid="status-timeline">
      {ORDER_STATUSES.filter((s) => s !== "CANCELLED").map((s, i) => {
        const ev = [...events].reverse().find((e) => e.toStatus === s);
        return (
          <li key={s} className={cn("rounded-lg p-2 text-center text-xs ring-1", i <= current ? "bg-brand-50 font-semibold text-brand-800 ring-brand-300" : "text-ink-400 ring-ink-200")}>
            {t(s)}
            {ev ? <span className="num block font-normal text-ink-500">{ev.at}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
