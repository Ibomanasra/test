import { setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { PricePreview } from "@/components/admin/PricePreview";
import { priceOptions } from "@/server/services/price-options";
import { pricePage } from "../guard";

export default async function PreviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale);
  if (!g) return <Forbidden />;
  const opts = await priceOptions(locale);
  return <PricePreview customers={opts.customers} skuOptions={opts.skuOptions} canSeeCost={g.canSeeCost} />;
}
