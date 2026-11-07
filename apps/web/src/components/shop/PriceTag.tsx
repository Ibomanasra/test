import { formatBps, formatMoney } from "@sa/core";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui";

/**
 * Preisanzeige je Kanal:
 *  B2C: Bruttopreis „inkl. MwSt.“
 *  B2B: Nettopreis pro Stück UND pro Verkaufseinheit (Karton), „netto zzgl. 16 % MwSt.“
 */
export function PriceTag({
  channel,
  unitPrice,
  listUnitPrice,
  factor,
  unitName,
  vatBps,
  size = "md",
}: {
  channel: "B2C" | "B2B";
  unitPrice: number;
  listUnitPrice?: number | null;
  factor?: number;
  unitName?: string;
  vatBps: number;
  size?: "sm" | "md" | "lg";
}) {
  const t = useTranslations("shop.price");
  return (
    <div className="space-y-0.5" data-testid="price-tag">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={cn("num font-bold", listUnitPrice ? "text-red-700" : "text-ink-900", size === "lg" ? "text-3xl" : size === "sm" ? "text-base sm:text-lg" : "text-lg")}>{formatMoney(unitPrice)}</span>
        {listUnitPrice ? <span className={cn("num text-ink-400 line-through", size === "sm" ? "text-xs" : "text-sm")}>{formatMoney(listUnitPrice)}</span> : null}
        <span className={cn("text-ink-500", size === "sm" ? "text-[11px]" : "text-xs")}>{channel === "B2B" ? t("perPieceNet") : t("perPiece")}</span>
      </div>
      {channel === "B2B" && factor && factor > 1 ? (
        <p className={size === "sm" ? "text-xs text-ink-700" : "text-sm text-ink-700"}>
          <span className="num font-semibold">{formatMoney(unitPrice * factor)}</span> / {unitName} ({t("pieces", { count: factor })})
        </p>
      ) : null}
      {/* auf Karten (sm) nur für Händler – Endkundenpreise sind immer inkl. MwSt. (steht im Fuß) */}
      {size !== "sm" || channel === "B2B" ? <p className={cn("text-ink-500", size === "sm" ? "text-[11px]" : "text-xs")}>{channel === "B2B" ? t("netPlusVat", { rate: formatBps(vatBps) }) : t("inclVat")}</p> : null}
    </div>
  );
}
