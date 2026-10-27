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
  size?: "md" | "lg";
}) {
  const t = useTranslations("shop.price");
  return (
    <div className="space-y-0.5" data-testid="price-tag">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={cn("num font-bold text-ink-900", size === "lg" ? "text-3xl" : "text-lg")}>{formatMoney(unitPrice)}</span>
        {listUnitPrice ? <span className="num text-sm text-ink-400 line-through">{formatMoney(listUnitPrice)}</span> : null}
        <span className="text-xs text-ink-500">{channel === "B2B" ? t("perPieceNet") : t("perPiece")}</span>
      </div>
      {channel === "B2B" && factor && factor > 1 ? (
        <p className="text-sm text-ink-700">
          <span className="num font-semibold">{formatMoney(unitPrice * factor)}</span> / {unitName} ({t("pieces", { count: factor })})
        </p>
      ) : null}
      <p className="text-xs text-ink-500">{channel === "B2B" ? t("netPlusVat", { rate: formatBps(vatBps) }) : t("inclVat")}</p>
    </div>
  );
}
