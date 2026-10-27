import { getTranslations, setRequestLocale } from "next-intl/server";
import { CartView } from "@/components/shop/CartView";
import { PageHeader } from "@/components/ui";
import { getAuth } from "@/server/auth/context";
import { cartOwner, pricedCart } from "@/server/services/cart";

export const dynamic = "force-dynamic";

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await getAuth();
  const [t, cart] = await Promise.all([getTranslations("shop.cart"), pricedCart(cartOwner(auth))]);
  return (
    <div>
      <PageHeader title={t("title")} />
      <CartView cart={cart} loggedIn={!!auth?.customer} isB2B={auth?.channel === "B2B"} />
    </div>
  );
}
