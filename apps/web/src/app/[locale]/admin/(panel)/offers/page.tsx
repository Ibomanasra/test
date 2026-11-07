import { hasPermission } from "@sa/core";
import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { OffersCenter, type OfferItem, type OfferValues } from "@/components/admin/OffersCenter";
import { Badge, Card, PageHeader, cn } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { money } from "@/server/format";
import { offerProductRows } from "@/server/services/offer-products";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, moneyInput, pctInput } from "@/server/format";
import { listOrderOffers } from "@/server/services/offers";
import { priceOptions } from "@/server/services/price-options";

/** Letzter gültiger Tag aus einem exklusiven Ende (00:00 des Folgetags) */
const lastDay = (d: Date | null) => (d ? day(new Date(d.getTime() - 1)) : "");

export default async function OffersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ new?: string; sku?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const NEW_TYPES = ["PERCENT", "FIXED_PRICE", "BUY_X_GET_Y", "WELCOME", "CART_THRESHOLD", "COUPON", "FREE_DELIVERY"] as const;
  const initialNew = NEW_TYPES.find((x) => x === sp.new);
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "price.view");
  if (!auth) return <Forbidden />;
  const [t, opts, orderOffers, promos, productRows] = await Promise.all([
    getTranslations("admin.offers"),
    priceOptions(locale),
    listOrderOffers(),
    prisma.promotion.findMany({ orderBy: { startsAt: "desc" }, include: { targets: true } }),
    offerProductRows(locale),
  ]);
  const now = new Date();
  const status = (active: boolean, from: Date | null, to: Date | null, usedUp = false): OfferItem["status"] =>
    !active ? "inactive" : from && from > now ? "planned" : to && to <= now ? "ended" : usedUp ? "used_up" : "active";
  const base: OfferValues = {
    nameAr: "", nameEn: "", textAr: "", textEn: "", channel: "BOTH", from: "", to: "", valueMode: "percent", percent: "", amount: "", minOrder: "",
    code: "", maxUses: "", perCustomer: "", showInShop: true, active: true, targetMode: "product", targetSku: "", targetCategoryId: "", fixedPrice: "", buyQty: "", getQty: "",
  };

  const items: OfferItem[] = [
    ...orderOffers.map((o) => ({
      id: o.id,
      type: o.kind,
      used: o.usedCount,
      status: status(o.active, o.startsAt, o.endsAt, o.maxUses != null && o.usedCount >= o.maxUses),
      values: {
        ...base,
        nameAr: o.nameAr,
        nameEn: o.nameEn,
        textAr: o.textAr ?? "",
        textEn: o.textEn ?? "",
        channel: o.channel,
        from: o.startsAt ? day(o.startsAt) : "",
        to: lastDay(o.endsAt),
        valueMode: o.amountAgorot ? ("amount" as const) : ("percent" as const),
        percent: pctInput(o.percentBps),
        amount: moneyInput(o.amountAgorot),
        minOrder: o.minOrderAgorot ? moneyInput(o.minOrderAgorot) : "",
        code: o.code ?? "",
        maxUses: o.maxUses?.toString() ?? "",
        perCustomer: o.perCustomerLimit?.toString() ?? "",
        showInShop: o.showInShop,
        active: o.active,
      },
    })),
    ...promos.map((p) => {
      const target = p.targets[0];
      const sku = target?.variantId ? (opts.variantSku.get(target.variantId) ?? "") : "";
      return {
        id: p.id,
        type: p.type,
        used: 0,
        status: status(p.active, p.startsAt, p.endsAt),
        targetLabel: target?.categoryId ? opts.categories.find((c) => c.value === target.categoryId)?.label : target?.variantId ? opts.variantLabel.get(target.variantId) : undefined,
        values: {
          ...base,
          nameAr: p.nameAr,
          nameEn: p.nameEn,
          channel: p.channel,
          from: day(p.startsAt),
          to: day(p.endsAt),
          percent: pctInput(p.percentBps),
          fixedPrice: moneyInput(target?.fixedPrice),
          buyQty: p.buyQty?.toString() ?? "",
          getQty: p.getQty?.toString() ?? "",
          targetMode: target?.categoryId ? ("category" as const) : ("product" as const),
          targetSku: sku,
          targetCategoryId: target?.categoryId ?? "",
          active: p.active,
        },
      };
    }),
  ].sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1));

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <OffersCenter items={items} skuOptions={opts.skuOptions} categories={opts.categories} canEdit={hasPermission(auth.permissions, "price.promotions")} initialNew={initialNew && hasPermission(auth.permissions, "price.promotions") ? { type: initialNew, sku: sp.sku } : undefined} />
      <Card title={`🏷️ ${t("products.title")}`}>
        <p className="mb-3 text-sm text-ink-600">{t("products.hint")}</p>
        {productRows.length === 0 ? (
          <p className="text-sm text-ink-500" data-testid="offer-products-empty">{t("products.none")}</p>
        ) : (
          <ul className="divide-y divide-ink-100" data-testid="offer-products">
            {productRows.map((r) => {
              const price = (label: string, x: { normal: number; offer: number; free: string | null } | null) =>
                x ? (
                  <div className="text-sm">
                    <span className="text-xs text-ink-500">{label}: </span>
                    {x.free ? (
                      <span className="font-semibold text-green-700">{t("products.freeQty", { qty: x.free })}</span>
                    ) : x.offer < x.normal ? (
                      <>
                        <span className="num text-ink-400 line-through">{money(x.normal)}</span>{" "}
                        <span className="num font-bold text-red-700" data-testid="offer-price">{money(x.offer)}</span>
                      </>
                    ) : (
                      <span className="num text-amber-700">{money(x.offer)} · {t("products.noEffect")}</span>
                    )}
                  </div>
                ) : null;
              return (
                <li key={`${r.promotionId}-${r.variantId}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3" data-testid="offer-product-row">
                  {r.imageId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/v1/images/${r.imageId}`} alt="" className="size-12 shrink-0 rounded-lg bg-ink-50 object-contain ring-1 ring-ink-200" />
                  ) : (
                    <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-ink-100 text-lg">📦</div>
                  )}
                  <div className="min-w-0 flex-1 basis-40">
                    <Link href={`/admin/products/${r.productId}`} className="font-medium text-ink-900 hover:text-brand-700 hover:underline">{r.name}</Link>
                    <p className="text-xs text-ink-500">
                      <span className="num">{r.sku}</span> · {r.promotionName}
                      {r.viaCategory != null ? ` · ${t("products.viaCategory", { name: r.viaCategory })}` : ""}
                    </p>
                  </div>
                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <div className="flex flex-col items-start gap-0.5 sm:items-end">
                    {price(t("channel.B2C"), r.b2c)}
                    {price(t("channel.B2B"), r.b2b)}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                    <Badge tone={r.status === "active" ? "green" : "blue"}>{t(`status.${r.status === "active" ? "active" : "planned"}`)}</Badge>
                    <span className={cn("num text-ink-500")}>{r.status === "planned" ? t("products.from", { date: day(r.startsAt) }) : t("products.until", { date: lastDay(r.endsAt) })}</span>
                  </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
