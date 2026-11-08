import type { OrderStatusKey } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CheckoutSteps } from "@/components/shop/CheckoutSteps";
import { OrderStatusTimeline } from "@/components/shop/OrderStatusTimeline";
import { Card, Num } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { dateTimeText, day, money } from "@/server/format";
import { verifyGuestOrderToken } from "@/server/services/guest-checkout";
import { getOrder } from "@/server/services/orders";

export const dynamic = "force-dynamic";

/** Bestellbestätigung für Gäste (ohne Konto) – nur mit geheimem Link (?k=…) erreichbar */
export default async function GuestOrderPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ k?: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { k } = await searchParams;
  if (!verifyGuestOrderToken(id, k)) notFound();
  const o = await getOrder(id).catch(() => notFound());
  const [t, tc, tAll] = await Promise.all([getTranslations("account.orders"), getTranslations("shop.checkout.guest"), getTranslations()]);
  const addr = o.addressSnapshot as { recipient: string; city: string; street?: string; details?: string; phone: string };
  const nm = (i: { nameArSnapshot: string; nameEnSnapshot: string }) => (locale === "ar" ? i.nameArSnapshot : i.nameEnSnapshot);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CheckoutSteps current={3} />
      <div className="rounded-2xl bg-green-50 p-6 text-center ring-1 ring-green-200" data-testid="order-placed">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-green-600 text-2xl text-white">✓</div>
        <p className="mt-3 text-lg font-bold text-green-900">{t("placed", { number: o.number })}</p>
        <p className="mt-1 text-sm text-green-800">{tc("placedText")}</p>
        <p className="mt-2 text-xs text-green-800">{tc("saveLink")}</p>
      </div>
      <Card><OrderStatusTimeline status={o.status as OrderStatusKey} events={o.events.map((e) => ({ toStatus: e.toStatus, at: dateTimeText(e.createdAt) }))} /></Card>
      <Card>
        <ul className="divide-y divide-ink-100 text-sm">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>{nm(i)} <span className="num text-ink-500">× {i.qty} {tAll(`units.${i.unitCode}`)}</span></span>
              <span className="num shrink-0">{money(i.lineGross)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-ink-200 pt-3 text-sm">
          <p className="flex justify-between"><span>{t("goodsValue")}</span><span className="num">{money(o.totalGross - o.deliveryFeeGross)}</span></p>
          <p className="flex justify-between"><span>{t("deliveryFee")}</span>{o.deliveryFeeGross > 0 ? <span className="num">{money(o.deliveryFeeGross)}</span> : <span className="text-green-700">{t("deliveryFree")}</span>}</p>
          <p className="flex justify-between text-base font-bold"><span>{t("total")}</span><span className="num" data-testid="guest-order-total">{money(o.totalGross)}</span></p>
        </div>
      </Card>
      <Card>
        <p className="text-sm"><span className="font-medium">{addr.recipient}</span> · <Num>{addr.phone}</Num></p>
        <p className="text-sm text-ink-600">{[addr.city, addr.street, addr.details].filter(Boolean).join("، ")}</p>
        <p className="mt-2 text-sm">{t("requestedDay")}: <Num>{day(o.requestedDeliveryDate)}</Num> · {tAll(`paymentMethod.${o.paymentMethod}`)}</p>
      </Card>
      <div className="rounded-2xl bg-brand-50 p-5 text-center ring-1 ring-brand-200">
        <p className="font-semibold text-ink-900">{tc("accountTitle")}</p>
        <p className="mt-1 text-sm text-ink-600">{tc("accountText")}</p>
        <Link href="/register" className="mt-3 inline-block rounded-xl bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800">{tc("accountCta")}</Link>
      </div>
      <p className="text-center"><Link href="/products" className="text-sm text-brand-700 hover:underline">{tAll("shop.cart.continue")}</Link></p>
    </div>
  );
}
