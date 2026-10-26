import { prisma } from "@sa/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { Forbidden } from "@/components/admin/Forbidden";
import { dateTimeLocal, dateTimeText, money, moneyInput, pct, pctInput } from "@/server/format";
import { priceOptions } from "@/server/services/price-options";
import { pricePage } from "../guard";

export default async function PromotionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await pricePage(locale, "price.promotions");
  if (!g) return <Forbidden />;
  const [t, tc, tAll, opts, promos] = await Promise.all([
    getTranslations("admin.prices"),
    getTranslations("common"),
    getTranslations(),
    priceOptions(locale),
    prisma.promotion.findMany({ orderBy: { startsAt: "desc" }, include: { targets: true } }),
  ]);
  const now = new Date();
  const status = (p: (typeof promos)[number]) =>
    !p.active ? t("promoStatus.inactive") : p.startsAt > now ? t("promoStatus.planned") : p.endsAt <= now ? t("promoStatus.ended") : t("promoStatus.active");
  return (
    <CrudManager
      endpoint="/api/v1/admin/prices/rules/promotions"
      canEdit={g.canEdit}
      createLabel={t("newPromotion")}
      skuOptions={opts.skuOptions}
      defaults={{ channel: "B2C", type: "PERCENT", active: true, priority: "0" }}
      fields={[
        { name: "nameAr", label: t("nameAr"), type: "text", required: true, dir: "rtl" },
        { name: "nameEn", label: t("nameEn"), type: "text", required: true, dir: "ltr" },
        { name: "channel", label: t("channel"), type: "select", required: true, options: (["B2C", "B2B", "BOTH"] as const).map((c) => ({ value: c, label: t(`channelScope.${c}`) })) },
        { name: "type", label: t("promoType"), type: "select", required: true, options: (["PERCENT", "FIXED_PRICE", "BUY_X_GET_Y"] as const).map((c) => ({ value: c, label: t(`promoTypes.${c}`) })) },
        { name: "percentBps", label: t("discountPct"), type: "bps", showIf: { field: "type", in: ["PERCENT"] } },
        { name: "fixedPrice", label: t("fixedPrice"), type: "money", showIf: { field: "type", in: ["FIXED_PRICE"] }, hint: t("fixedPriceHint") },
        { name: "buyQty", label: t("buyQty"), type: "int", showIf: { field: "type", in: ["BUY_X_GET_Y"] } },
        { name: "getQty", label: t("getQty"), type: "int", showIf: { field: "type", in: ["BUY_X_GET_Y"] } },
        { name: "targetSku", label: t("targetSku"), type: "sku", hint: t("targetHint") },
        { name: "targetCategoryId", label: t("targetCategory"), type: "select", options: opts.categories },
        { name: "groupId", label: t("onlyGroup"), type: "select", options: opts.groups, showIf: { field: "channel", in: ["B2B", "BOTH"] } },
        { name: "startsAt", label: t("startsAt"), type: "datetime", required: true },
        { name: "endsAt", label: t("endsAt"), type: "datetime", required: true },
        { name: "priority", label: t("priority"), type: "int" },
        { name: "active", label: tc("active"), type: "checkbox" },
      ]}
      columns={[
        { key: "name", label: tc("name") },
        { key: "channel", label: t("channel") },
        { key: "type", label: t("promoType") },
        { key: "target", label: t("appliesTo") },
        { key: "period", label: t("period"), className: "num" },
        { key: "status", label: tc("status") },
      ]}
      rows={promos.map((p) => {
        const target = p.targets[0];
        const effect =
          p.type === "PERCENT" ? `-${pct(p.percentBps)}` : p.type === "FIXED_PRICE" ? money(target?.fixedPrice) : `${p.buyQty} + ${p.getQty}`;
        return {
          id: p.id,
          tone: p.active && p.startsAt <= now && p.endsAt > now ? undefined : ("muted" as const),
          values: {
            nameAr: p.nameAr,
            nameEn: p.nameEn,
            channel: p.channel,
            type: p.type,
            percentBps: pctInput(p.percentBps),
            fixedPrice: moneyInput(target?.fixedPrice),
            buyQty: p.buyQty?.toString() ?? "",
            getQty: p.getQty?.toString() ?? "",
            targetSku: target?.variantId ? (opts.variantSku.get(target.variantId) ?? "") : "",
            targetCategoryId: target?.categoryId ?? "",
            groupId: p.groupId ?? "",
            startsAt: dateTimeLocal(p.startsAt),
            endsAt: dateTimeLocal(p.endsAt),
            priority: String(p.priority),
            active: p.active,
          },
          cells: {
            name: locale === "ar" ? p.nameAr : p.nameEn,
            channel: t(`channelScope.${p.channel}`) + (p.groupId ? ` · ${opts.groupName.get(p.groupId) ?? ""}` : ""),
            type: `${t(`promoTypes.${p.type}`)} (${effect})`,
            target: target?.variantId ? (opts.variantLabel.get(target.variantId) ?? "") : target?.categoryId ? `${t("category")}: ${opts.categoryName.get(target.categoryId) ?? ""}` : "–",
            period: `${dateTimeText(p.startsAt)} → ${dateTimeText(p.endsAt)}`,
            status: status(p),
          },
        };
      })}
      emptyText={tAll("common.noResults")}
    />
  );
}
