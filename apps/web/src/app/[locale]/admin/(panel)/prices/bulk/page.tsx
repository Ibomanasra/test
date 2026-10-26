import { hasPermission } from "@sa/core";
import { setRequestLocale } from "next-intl/server";
import { BulkPriceTools } from "@/components/admin/BulkPriceTools";
import { Forbidden } from "@/components/admin/Forbidden";
import { priceOptions } from "@/server/services/price-options";
import { pricePage } from "../guard";

export default async function BulkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale, "price.bulk");
  if (!g || !hasPermission(g.auth.permissions, "price.bulk")) return <Forbidden />;
  const opts = await priceOptions(locale);
  return <BulkPriceTools categories={opts.categories} canSeeCost={g.canSeeCost} />;
}
