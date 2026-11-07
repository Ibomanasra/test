import { getTranslations, setRequestLocale } from "next-intl/server";
import { CartView } from "@/components/shop/CartView";
import { CheckoutSteps } from "@/components/shop/CheckoutSteps";
import { getAuth } from "@/server/auth/context";
import { cartOwner, pricedCart } from "@/server/services/cart";
import { evaluateOrderOffers } from "@/server/services/offers";

export const dynamic = "force-dynamic";

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await getAuth();
  const [t, cart] = await Promise.all([getTranslations("shop.cart"), pricedCart(cartOwner(auth))]);
  // Vorschau der Bestellangebote (ohne Gutschein; Gutschein an der Kasse)
  const offers = cart.lines.length ? await evaluateOrderOffers({ customerId: auth?.customer?.id ?? null, channel: cart.channel, goodsValue: cart.goodsValue }) : null;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-ink-900">{t("title")}</h1>
      {cart.lines.length ? <CheckoutSteps current={1} /> : null}
      <CartView
        cart={cart}
        loggedIn={!!auth?.customer}
        isB2B={auth?.channel === "B2B"}
        offer={{
          current: offers?.discount ? { nameAr: offers.discount.rule.nameAr, nameEn: offers.discount.rule.nameEn, amount: offers.discount.amount } : null,
          next: offers?.next ? { missing: offers.next.missing, target: offers.next.rule.minOrderAgorot, percentBps: offers.next.rule.percentBps, amountAgorot: offers.next.rule.amountAgorot } : null,
        }}
      />
    </div>
  );
}
