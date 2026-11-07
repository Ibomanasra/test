"use client";

import { businessDate, parsePercentToBps, parseShekel } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Icon, type IconName } from "@/components/admin/Icon";
import { Alert, Button, Card, Field, Input, Select, cn } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export type OfferType = "PERCENT" | "FIXED_PRICE" | "BUY_X_GET_Y" | "WELCOME" | "CART_THRESHOLD" | "COUPON" | "FREE_DELIVERY";
const PRODUCT_TYPES: OfferType[] = ["PERCENT", "FIXED_PRICE", "BUY_X_GET_Y"];
const ORDER_TYPES: OfferType[] = ["WELCOME", "CART_THRESHOLD", "COUPON", "FREE_DELIVERY"];
const isProduct = (k: OfferType) => PRODUCT_TYPES.includes(k);

const TYPE_STYLE: Record<OfferType, { icon: IconName; tone: string }> = {
  PERCENT: { icon: "percent", tone: "bg-rose-50 text-rose-700" },
  FIXED_PRICE: { icon: "tag", tone: "bg-orange-50 text-orange-700" },
  BUY_X_GET_Y: { icon: "box", tone: "bg-amber-50 text-amber-700" },
  WELCOME: { icon: "users", tone: "bg-violet-50 text-violet-700" },
  CART_THRESHOLD: { icon: "cart", tone: "bg-sky-50 text-sky-700" },
  COUPON: { icon: "file", tone: "bg-emerald-50 text-emerald-700" },
  FREE_DELIVERY: { icon: "truck", tone: "bg-teal-50 text-teal-700" },
};

/** Formularwerte als Strings – gleich für alle Typen, je Typ nur ein Teil sichtbar */
export interface OfferValues {
  nameAr: string;
  nameEn: string;
  textAr: string;
  textEn: string;
  channel: "BOTH" | "B2C" | "B2B";
  from: string;
  to: string;
  valueMode: "percent" | "amount";
  percent: string;
  amount: string;
  minOrder: string;
  code: string;
  maxUses: string;
  perCustomer: string;
  showInShop: boolean;
  active: boolean;
  targetMode: "product" | "category";
  targetSku: string;
  targetCategoryId: string;
  fixedPrice: string;
  buyQty: string;
  getQty: string;
}

export interface OfferItem {
  id: string;
  type: OfferType;
  values: OfferValues;
  status: "active" | "planned" | "ended" | "inactive" | "used_up";
  used: number;
  targetLabel?: string;
}

const EMPTY: OfferValues = {
  nameAr: "", nameEn: "", textAr: "", textEn: "", channel: "BOTH", from: "", to: "", valueMode: "percent", percent: "", amount: "", minOrder: "",
  code: "", maxUses: "", perCustomer: "", showInShop: true, active: true, targetMode: "product", targetSku: "", targetCategoryId: "", fixedPrice: "", buyQty: "", getQty: "",
};

const money = (s: string) => {
  try {
    return s ? parseShekel(s) : null;
  } catch {
    return undefined;
  }
};
/** Datum in n Tagen (Geschäftstag) – außerhalb der Komponente (Render bleibt rein) */
const inDays = (n: number) => businessDate(new Date(Date.now() + n * 86_400_000));
const int = (s: string) => (s.trim() ? Number.parseInt(s, 10) : null);

export function OffersCenter({
  items,
  skuOptions,
  categories,
  canEdit,
}: {
  items: OfferItem[];
  skuOptions: { sku: string; label: string }[];
  categories: { value: string; label: string }[];
  canEdit: boolean;
}) {
  const t = useTranslations("admin.offers");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const [editing, setEditing] = useState<{ type: OfferType | null; id?: string; v: OfferValues } | null>(null);
  const [filter, setFilter] = useState<"all" | "product" | "order">("all");

  const set = <K extends keyof OfferValues>(k: K, val: OfferValues[K]) => setEditing((e) => (e ? { ...e, v: { ...e.v, [k]: val } } : e));

  /** Kurztext der Wirkung, z. B. „−10 %“, „−20 ₪“, „2 + 1 gratis“ */
  const effect = (type: OfferType, v: OfferValues) => {
    if (type === "FREE_DELIVERY") return t("effect.freeDelivery");
    if (type === "FIXED_PRICE") return v.fixedPrice ? t("effect.fixed", { price: `${v.fixedPrice} ₪` }) : "…";
    if (type === "BUY_X_GET_Y") return v.buyQty && v.getQty ? t("effect.buyGet", { buy: v.buyQty, get: v.getQty }) : "…";
    if (type === "PERCENT" || v.valueMode === "percent") return v.percent ? `−${v.percent}%` : "…";
    return v.amount ? `−${v.amount} ₪` : "…";
  };
  const condition = (type: OfferType, v: OfferValues, targetLabel?: string) => {
    const parts: string[] = [];
    if (isProduct(type)) parts.push(targetLabel || (v.targetMode === "category" ? categories.find((c) => c.value === v.targetCategoryId)?.label : skuOptions.find((s) => s.sku === v.targetSku)?.label) || "…");
    if (type === "WELCOME") parts.push(t("cond.firstOrder"));
    if (type === "COUPON" && v.code) parts.push(t("cond.code", { code: v.code.toUpperCase() }));
    if (v.minOrder) parts.push(t("cond.minOrder", { amount: `${v.minOrder} ₪` }));
    if (v.channel !== "BOTH") parts.push(t(`channel.${v.channel}`));
    if (v.to) parts.push(t("cond.until", { date: v.to }));
    return parts.join(" · ");
  };

  function startNew(type: OfferType) {
    const today = inDays(0);
    const in30 = inDays(30);
    setError(null);
    setEditing({
      type,
      v: {
        ...EMPTY,
        nameAr: t(`defaults.${type}.ar`),
        nameEn: t(`defaults.${type}.en`),
        from: isProduct(type) ? today : "",
        to: isProduct(type) ? in30 : "",
        percent: type === "WELCOME" ? "10" : type === "CART_THRESHOLD" ? "5" : "",
        minOrder: type === "CART_THRESHOLD" ? "300" : "",
        perCustomer: type === "COUPON" ? "1" : "",
      },
    });
  }

  function body(type: OfferType, v: OfferValues): Record<string, unknown> | string {
    const nameEn = v.nameEn.trim() || v.nameAr.trim();
    if (isProduct(type)) {
      if (!v.to) return "invalid_period";
      const fixed = money(v.fixedPrice);
      if (fixed === undefined) return "invalid_amount";
      let percentBps: number | null = null;
      if (type === "PERCENT") {
        try {
          percentBps = parsePercentToBps(v.percent);
        } catch {
          return "percent_required";
        }
      }
      return {
        nameAr: v.nameAr.trim(),
        nameEn,
        channel: v.channel,
        type,
        startsAt: `${v.from || inDays(0)}T00:00`,
        endsAt: `${v.to}T23:59`,
        active: v.active,
        priority: 0,
        percentBps,
        fixedPrice: type === "FIXED_PRICE" ? fixed : null,
        buyQty: type === "BUY_X_GET_Y" ? int(v.buyQty) : null,
        getQty: type === "BUY_X_GET_Y" ? int(v.getQty) : null,
        targetSku: v.targetMode === "product" || type === "FIXED_PRICE" ? v.targetSku : "",
        targetCategoryId: v.targetMode === "category" && type !== "FIXED_PRICE" ? v.targetCategoryId : "",
      };
    }
    const amount = money(v.amount);
    const minOrder = money(v.minOrder);
    if (amount === undefined || minOrder === undefined) return "invalid_amount";
    let percentBps: number | null = null;
    if (type !== "FREE_DELIVERY" && v.valueMode === "percent") {
      try {
        percentBps = parsePercentToBps(v.percent);
      } catch {
        return "percent_required";
      }
    }
    return {
      kind: type,
      nameAr: v.nameAr.trim(),
      nameEn,
      textAr: v.textAr,
      textEn: v.textEn,
      channel: v.channel,
      active: v.active,
      startsAt: v.from,
      endsAt: v.to,
      percentBps,
      amountAgorot: type !== "FREE_DELIVERY" && v.valueMode === "amount" ? amount : null,
      minOrderAgorot: minOrder ?? 0,
      code: type === "COUPON" ? v.code : "",
      maxUses: int(v.maxUses),
      perCustomerLimit: int(v.perCustomer),
      showInShop: v.showInShop,
    };
  }

  const endpoint = (type: OfferType, id?: string) => (isProduct(type) ? `/api/v1/admin/prices/rules/promotions${id ? `/${id}` : ""}` : `/api/v1/admin/offers${id ? `/${id}` : ""}`);

  async function save() {
    if (!editing?.type) return;
    const b = body(editing.type, editing.v);
    if (typeof b === "string") return setError(te.has(b) ? te(b) : te("validation_error"));
    if (await call(endpoint(editing.type, editing.id), { method: editing.id ? "PUT" : "POST", body: b })) {
      setEditing(null);
      router.refresh();
    }
  }

  async function toggle(item: OfferItem) {
    const b = body(item.type, { ...item.values, active: !item.values.active });
    if (typeof b === "string") return setError(te(b));
    if (await call(endpoint(item.type, item.id), { method: "PUT", body: b })) router.refresh();
  }

  async function remove(item: OfferItem) {
    if (!window.confirm(t("deleteConfirm"))) return;
    if (await call(endpoint(item.type, item.id), { method: "DELETE" })) router.refresh();
  }

  const shown = items.filter((i) => filter === "all" || (filter === "product") === isProduct(i.type));
  const STATUS_TONE = { active: "bg-green-100 text-green-800", planned: "bg-sky-100 text-sky-800", ended: "bg-ink-100 text-ink-500", inactive: "bg-ink-100 text-ink-500", used_up: "bg-amber-100 text-amber-900" } as const;

  // ---- Editor ---------------------------------------------------------------
  if (editing) {
    const { type, v } = editing;
    if (!type) return null;
    const pv = (label: string) => (
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-md">
        <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
        <p className="mt-1 text-3xl font-bold"><bdi dir={type === "FIXED_PRICE" || type === "BUY_X_GET_Y" || type === "FREE_DELIVERY" ? undefined : "ltr"}>{effect(type, v)}</bdi></p>
        <p className="mt-1 font-semibold">{locale === "ar" ? v.nameAr : v.nameEn || v.nameAr}</p>
        {(locale === "ar" ? v.textAr : v.textEn) ? <p className="mt-1 text-sm text-white/85">{locale === "ar" ? v.textAr : v.textEn}</p> : null}
        <p className="mt-2 text-xs text-white/80">{condition(type, v)}</p>
        {type === "COUPON" && v.code ? <p className="mt-3 inline-block rounded-lg border border-dashed border-white/60 px-3 py-1 font-mono text-lg tracking-widest">{v.code.toUpperCase()}</p> : null}
      </div>
    );
    return (
      <div className="grid gap-6 lg:grid-cols-3" data-testid="offer-editor">
        <Card title={`${editing.id ? tc("edit") : t("new")}: ${t(`types.${type}.title`)}`} className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("f.nameAr")} htmlFor="o-nameAr"><Input id="o-nameAr" dir="rtl" value={v.nameAr} onChange={(e) => set("nameAr", e.target.value)} /></Field>
            <Field label={t("f.nameEn")} htmlFor="o-nameEn" hint={t("f.nameEnHint")}><Input id="o-nameEn" dir="ltr" value={v.nameEn} onChange={(e) => set("nameEn", e.target.value)} /></Field>

            {/* Wert */}
            {type === "PERCENT" ? (
              <Field label={t("f.percent")} htmlFor="o-percent"><Input id="o-percent" inputMode="decimal" dir="ltr" className="num" value={v.percent} onChange={(e) => set("percent", e.target.value)} placeholder="10" /></Field>
            ) : null}
            {type === "FIXED_PRICE" ? (
              <Field label={t("f.fixedPrice")} htmlFor="o-fixed" hint={t("f.fixedHint")}><Input id="o-fixed" inputMode="decimal" dir="ltr" className="num" value={v.fixedPrice} onChange={(e) => set("fixedPrice", e.target.value)} placeholder="9.90" /></Field>
            ) : null}
            {type === "BUY_X_GET_Y" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("f.buy")} htmlFor="o-buy"><Input id="o-buy" inputMode="numeric" dir="ltr" className="num" value={v.buyQty} onChange={(e) => set("buyQty", e.target.value)} placeholder="2" /></Field>
                <Field label={t("f.get")} htmlFor="o-get"><Input id="o-get" inputMode="numeric" dir="ltr" className="num" value={v.getQty} onChange={(e) => set("getQty", e.target.value)} placeholder="1" /></Field>
              </div>
            ) : null}
            {ORDER_TYPES.includes(type) && type !== "FREE_DELIVERY" ? (
              <div className="space-y-2">
                <div className="inline-flex rounded-lg bg-ink-100 p-0.5 text-sm">
                  {(["percent", "amount"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => set("valueMode", m)} className={cn("rounded-md px-3 py-1", v.valueMode === m ? "bg-white font-medium shadow-sm" : "text-ink-600")}>{t(`f.mode.${m}`)}</button>
                  ))}
                </div>
                {v.valueMode === "percent" ? (
                  <Input aria-label={t("f.percent")} inputMode="decimal" dir="ltr" className="num" value={v.percent} onChange={(e) => set("percent", e.target.value)} placeholder="10 %" data-testid="o-percent" />
                ) : (
                  <Input aria-label={t("f.amount")} inputMode="decimal" dir="ltr" className="num" value={v.amount} onChange={(e) => set("amount", e.target.value)} placeholder="20.00 ₪" />
                )}
              </div>
            ) : null}

            {/* Ziel (Produktangebote) */}
            {isProduct(type) ? (
              <div className="space-y-2 sm:col-span-2">
                {type !== "FIXED_PRICE" ? (
                  <div className="inline-flex rounded-lg bg-ink-100 p-0.5 text-sm">
                    {(["product", "category"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => set("targetMode", m)} className={cn("rounded-md px-3 py-1", v.targetMode === m ? "bg-white font-medium shadow-sm" : "text-ink-600")}>{t(`f.target.${m}`)}</button>
                    ))}
                  </div>
                ) : null}
                {v.targetMode === "category" && type !== "FIXED_PRICE" ? (
                  <Select aria-label={t("f.target.category")} value={v.targetCategoryId} onChange={(e) => set("targetCategoryId", e.target.value)}>
                    <option value="">{t("f.chooseCategory")}</option>
                    {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                ) : (
                  <>
                    <Input aria-label={t("f.target.product")} list="offer-skus" value={v.targetSku} onChange={(e) => set("targetSku", e.target.value)} placeholder={t("f.productPlaceholder")} dir="ltr" className="text-start" data-testid="o-sku" />
                    <datalist id="offer-skus">{skuOptions.map((s) => <option key={s.sku} value={s.sku}>{s.label}</option>)}</datalist>
                    {v.targetSku ? <p className="text-xs text-ink-500">{skuOptions.find((s) => s.sku === v.targetSku)?.label ?? t("f.unknownSku")}</p> : null}
                  </>
                )}
              </div>
            ) : null}

            {/* Bedingungen (Bestellangebote) */}
            {type === "COUPON" ? (
              <Field label={t("f.code")} htmlFor="o-code" hint={t("f.codeHint")}><Input id="o-code" dir="ltr" className="font-mono uppercase" value={v.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="RAMADAN10" /></Field>
            ) : null}
            {ORDER_TYPES.includes(type) ? (
              <Field label={t("f.minOrder")} htmlFor="o-min" hint={t("f.minOrderHint")}><Input id="o-min" inputMode="decimal" dir="ltr" className="num" value={v.minOrder} onChange={(e) => set("minOrder", e.target.value)} placeholder="0" /></Field>
            ) : null}

            <Field label={t("f.channel")} htmlFor="o-ch">
              <div className="inline-flex rounded-lg bg-ink-100 p-0.5 text-sm" id="o-ch">
                {(["BOTH", "B2C", "B2B"] as const).map((c) => (
                  <button key={c} type="button" onClick={() => set("channel", c)} className={cn("rounded-md px-3 py-1", v.channel === c ? "bg-white font-medium shadow-sm" : "text-ink-600")}>{t(`channel.${c}`)}</button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("f.from")} htmlFor="o-from"><Input id="o-from" type="date" dir="ltr" className="num" value={v.from} onChange={(e) => set("from", e.target.value)} /></Field>
              <Field label={t("f.to")} htmlFor="o-to" hint={isProduct(type) ? undefined : t("f.toHint")}><Input id="o-to" type="date" dir="ltr" className="num" value={v.to} onChange={(e) => set("to", e.target.value)} /></Field>
            </div>

            {ORDER_TYPES.includes(type) ? (
              <details className="text-sm sm:col-span-2">
                <summary className="cursor-pointer text-ink-600">{t("f.more")}</summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label={t("f.textAr")} htmlFor="o-textAr"><Input id="o-textAr" dir="rtl" value={v.textAr} onChange={(e) => set("textAr", e.target.value)} placeholder={t("f.textPlaceholder")} /></Field>
                  <Field label={t("f.textEn")} htmlFor="o-textEn"><Input id="o-textEn" dir="ltr" value={v.textEn} onChange={(e) => set("textEn", e.target.value)} /></Field>
                  <Field label={t("f.maxUses")} htmlFor="o-max" hint={t("f.emptyUnlimited")}><Input id="o-max" inputMode="numeric" dir="ltr" className="num" value={v.maxUses} onChange={(e) => set("maxUses", e.target.value)} /></Field>
                  {type !== "WELCOME" ? (
                    <Field label={t("f.perCustomer")} htmlFor="o-per" hint={t("f.emptyUnlimited")}><Input id="o-per" inputMode="numeric" dir="ltr" className="num" value={v.perCustomer} onChange={(e) => set("perCustomer", e.target.value)} /></Field>
                  ) : null}
                  <label className="flex items-center gap-2"><input type="checkbox" checked={v.showInShop} onChange={(e) => set("showInShop", e.target.checked)} className="size-4 accent-brand-700" /> {t("f.showInShop")}</label>
                </div>
              </details>
            ) : null}
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} className="size-4 accent-brand-700" /> {t("f.active")}</label>
          </div>
          {error ? <div className="mt-4"><Alert tone="red">{error}</Alert></div> : null}
          <div className="mt-5 flex gap-2">
            <Button onClick={() => void save()} disabled={pending || !v.nameAr.trim()} data-testid="offer-save">{tc("save")}</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>{tc("cancel")}</Button>
          </div>
        </Card>
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink-600">{t("preview")}</p>
          {pv(t(`types.${type}.title`))}
          <p className="text-xs text-ink-500">{t(`types.${type}.explain`)}</p>
        </div>
      </div>
    );
  }

  // ---- Übersicht ------------------------------------------------------------
  return (
    <div className="space-y-8">
      {canEdit ? (
        <section>
          <h2 className="mb-1 text-base font-semibold text-ink-900">{t("newTitle")}</h2>
          <p className="mb-3 text-sm text-ink-500">{t("newText")}</p>
          {(["order", "product"] as const).map((group) => (
            <div key={group} className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{t(`group.${group}`)}</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(group === "order" ? ORDER_TYPES : PRODUCT_TYPES).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => startNew(type)}
                    data-testid={`new-${type}`}
                    className="flex items-start gap-3 rounded-2xl bg-white p-4 text-start ring-1 ring-ink-200 transition hover:shadow-md hover:ring-brand-300"
                  >
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TYPE_STYLE[type].tone)}><Icon name={TYPE_STYLE[type].icon} /></span>
                    <span>
                      <span className="block font-semibold text-ink-900">{t(`types.${type}.title`)}</span>
                      <span className="block text-sm text-ink-500">{t(`types.${type}.short`)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="me-auto text-base font-semibold text-ink-900">{t("listTitle")}</h2>
          {(["all", "order", "product"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-sm ring-1", filter === f ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200")}>{t(`filter.${f}`)}</button>
          ))}
        </div>
        {error ? <div className="mb-3"><Alert tone="red">{error}</Alert></div> : null}
        {shown.length === 0 ? <p className="rounded-xl bg-white p-6 text-center text-sm text-ink-500 ring-1 ring-ink-200">{t("none")}</p> : null}
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => (
            <li key={`${item.type}-${item.id}`} data-testid="offer-card" className={cn("flex flex-col rounded-2xl bg-white p-4 ring-1 ring-ink-200", item.status !== "active" && "opacity-75")}>
              <div className="flex items-start gap-3">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TYPE_STYLE[item.type].tone)}><Icon name={TYPE_STYLE[item.type].icon} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-900">{locale === "ar" ? item.values.nameAr : item.values.nameEn || item.values.nameAr}</p>
                  <p className="text-xs text-ink-500">{t(`types.${item.type}.title`)}</p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[item.status])}>{t(`status.${item.status}`)}</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-ink-900"><bdi dir={item.type === "FIXED_PRICE" || item.type === "BUY_X_GET_Y" || item.type === "FREE_DELIVERY" ? undefined : "ltr"}>{effect(item.type, item.values)}</bdi></p>
              <p className="mt-1 text-sm text-ink-600">{condition(item.type, item.values, item.targetLabel)}</p>
              {!isProduct(item.type) ? <p className="mt-1 text-xs text-ink-500">{t("used", { count: item.used })}{item.values.maxUses ? ` / ${item.values.maxUses}` : ""}</p> : null}
              {canEdit ? (
                <div className="mt-4 flex gap-1 border-t border-ink-100 pt-3">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ type: item.type, id: item.id, v: item.values })}><Icon name="edit" className="size-4" /> {tc("edit")}</Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => void toggle(item)}>{item.values.active ? t("pause") : t("resume")}</Button>
                  <Button size="sm" variant="ghost" className="ms-auto text-red-700" disabled={pending} onClick={() => void remove(item)}>{tc("delete")}</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

