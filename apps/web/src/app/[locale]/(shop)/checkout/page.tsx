import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { PageHeader } from "@/components/ui";
import { redirect } from "@/i18n/navigation";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { cartOwner, pricedCart } from "@/server/services/cart";
import { checkoutOptions } from "@/server/services/orders";
import { listZones } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireCustomerPage(locale, "/checkout");
  const cart = await pricedCart(cartOwner(auth));
  if (cart.lines.length === 0) redirect({ href: "/cart", locale });
  const [t, options, zones] = await Promise.all([getTranslations("shop.checkout"), checkoutOptions(auth as Parameters<typeof checkoutOptions>[0]), listZones(true)]);
  return (
    <div>
      <PageHeader title={t("title")} />
      <CheckoutForm options={options} zones={zones.map((z) => ({ id: z.id, name: locale === "ar" ? z.nameAr : z.nameEn }))} />
    </div>
  );
}
