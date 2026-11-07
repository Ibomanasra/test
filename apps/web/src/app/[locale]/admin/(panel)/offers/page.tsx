import { hasPermission } from "@sa/core";
import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { OffersCenter, type OfferItem, type OfferValues } from "@/components/admin/OffersCenter";
import { PageHeader } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { day, moneyInput, pctInput } from "@/server/format";
import { listOrderOffers } from "@/server/services/offers";
import { priceOptions } from "@/server/services/price-options";

/** Letzter gültiger Tag aus einem exklusiven Ende (00:00 des Folgetags) */
const lastDay = (d: Date | null) => (d ? day(new Date(d.getTime() - 1)) : "");

export default async function OffersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "price.view");
  if (!auth) return <Forbidden />;
  const [t, opts, orderOffers, promos] = await Promise.all([
    getTranslations("admin.offers"),
    priceOptions(locale),
    listOrderOffers(),
    prisma.promotion.findMany({ orderBy: { startsAt: "desc" }, include: { targets: true } }),
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
      <OffersCenter items={items} skuOptions={opts.skuOptions} categories={opts.categories} canEdit={hasPermission(auth.permissions, "price.promotions")} />
    </div>
  );
}
