import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";

export function AvailabilityBadge({ value }: { value: "in_stock" | "low" | "out" }) {
  const t = useTranslations("shop.availability");
  return <Badge tone={value === "in_stock" ? "green" : value === "low" ? "amber" : "red"}>{t(value)}</Badge>;
}
