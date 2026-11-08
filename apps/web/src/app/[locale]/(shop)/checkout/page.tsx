import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { CheckoutSteps } from "@/components/shop/CheckoutSteps";
import { redirect } from "@/i18n/navigation";
import { getAuth } from "@/server/auth/context";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { guestPaymentMethods } from "@/server/services/guest-checkout";
import { cartOwner, pricedCart } from "@/server/services/cart";
import { checkoutOptions } from "@/server/services/orders";
import { listZones } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Gäste dürfen ohne Konto bestellen (Name, Telefon, Adresse im Formular)
  if (!(await getAuth())) {
    const guestCart = await pricedCart(cartOwner(null));
    if (guestCart.lines.length === 0) redirect({ href: "/cart", locale });
    const [tg, methods, zonesG] = await Promise.all([getTranslations("shop.checkout"), guestPaymentMethods(), listZones(true)]);
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold text-ink-900">{tg("title")}</h1>
        <CheckoutSteps current={2} />
        <CheckoutForm guest options={{ channel: "B2C", addresses: [], paymentMethods: methods, credit: null }} zones={zonesG.map((z) => ({ id: z.id, name: locale === "ar" ? z.nameAr : z.nameEn }))} />
      </div>
    );
  }
  const auth = await requireCustomerPage(locale, "/checkout");
  const cart = await pricedCart(cartOwner(auth));
  if (cart.lines.length === 0) redirect({ href: "/cart", locale });
  const [t, options, zones] = await Promise.all([getTranslations("shop.checkout"), checkoutOptions(auth as Parameters<typeof checkoutOptions>[0]), listZones(true)]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-ink-900">{t("title")}</h1>
      <CheckoutSteps current={2} />
      <CheckoutForm options={options} zones={zones.map((z) => ({ id: z.id, name: locale === "ar" ? z.nameAr : z.nameEn }))} />
    </div>
  );
}
