import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Alert } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { getAuth } from "@/server/auth/context";
import { cartCount, cartOwner } from "@/server/services/cart";

export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, auth] = await Promise.all([getTranslations("common"), getAuth()]);
  const ts = await getTranslations("shop");
  const customer = auth?.customer;
  const cartItems = auth?.isStaff ? 0 : await cartCount(cartOwner(auth));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-800">
            <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-brand-700 text-white">ش</span>
            {t("appName")}
          </Link>
          <nav className="order-3 flex w-full gap-4 overflow-x-auto text-sm font-medium text-ink-700 sm:order-none sm:ms-6 sm:w-auto">
            <Link href="/products" className="whitespace-nowrap hover:text-brand-700">{ts("nav.catalog")}</Link>
            <Link href="/products?promo=1" className="whitespace-nowrap hover:text-brand-700">{ts("nav.offers")}</Link>
            {auth?.channel === "B2B" ? (
              <Link href="/account/quick-order" className="whitespace-nowrap hover:text-brand-700">{ts("nav.quickOrder")}</Link>
            ) : (
              <Link href="/register?type=b2b" className="whitespace-nowrap hover:text-brand-700">{ts("nav.forBusiness")}</Link>
            )}
          </nav>
          <form action={`/${locale}/products`} className="order-4 w-full sm:order-none sm:ms-4 sm:w-56">
            <input name="q" placeholder={ts("searchPlaceholder")} aria-label={ts("searchPlaceholder")} className="w-full rounded-lg border border-ink-300 px-3 py-1.5 text-sm" />
          </form>
          <div className="ms-auto flex items-center gap-2">
            <Link href="/cart" className="relative rounded-lg px-3 py-1.5 text-sm ring-1 ring-ink-300 hover:bg-ink-100" data-testid="cart-link">
              {ts("nav.cart")}
              {cartItems > 0 ? <span className="num ms-1 rounded-full bg-brand-700 px-1.5 text-xs text-white" data-testid="cart-count">{cartItems}</span> : null}
            </Link>
            <Suspense>
              <LanguageSwitcher />
            </Suspense>
            {auth?.isStaff ? (
              <Link href="/admin" className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm text-white">{t("account")}</Link>
            ) : customer ? (
              <Link href="/account" className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white" data-testid="account-link">
                {t("account")}
              </Link>
            ) : (
              <Link href="/login" className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white" data-testid="login-link">
                {t("login")}
              </Link>
            )}
          </div>
        </div>
      </header>

      {customer?.status === "PENDING_APPROVAL" ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4">
          <Alert>{ts("pendingBanner")}</Alert>
        </div>
      ) : null}
      {customer?.status === "BLOCKED" ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4">
          <Alert tone="red">{ts("blockedBanner")}</Alert>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-ink-500 sm:flex-row sm:justify-between">
          <p>
            © <span className="num">{new Date().getFullYear()}</span> {t("appName")} – {ts("footer.rights")}
          </p>
          <p>{auth?.channel === "B2B" ? ts("footer.priceNoteB2B") : ts("footer.priceNoteB2C")}</p>
          <Link href="/admin/login" className="hover:text-ink-700">{(await getTranslations("auth"))("staffLink")}</Link>
        </div>
      </footer>
    </div>
  );
}
