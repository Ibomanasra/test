"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Input, Select, cn } from "@/components/ui";
import { useApi } from "@/lib/api-client";
import { useCart } from "./CartContext";

interface Unit {
  code: string;
  nameAr: string;
  nameEn: string;
  factor: number;
}

export function AddToCart({
  variantId,
  units,
  defaultUnit,
  minQtyBase,
  qtyStepBase,
  disabled,
  compact,
  name: productName,
  imageId,
}: {
  variantId: string;
  units: Unit[];
  defaultUnit: string;
  minQtyBase: number;
  qtyStepBase: number;
  disabled?: boolean;
  compact?: boolean;
  /** für die Bestätigung „Im Warenkorb“ */
  name?: string;
  imageId?: string | null;
}) {
  const t = useTranslations("shop.cart");
  const locale = useLocale();
  const cart = useCart();
  const { call, pending, error } = useApi();
  const [unit, setUnit] = useState(defaultUnit);
  const factor = units.find((u) => u.code === unit)?.factor ?? 1;
  const minUnits = Math.max(1, Math.ceil(minQtyBase / factor));
  const [qty, setQty] = useState(String(minUnits));
  const [added, setAdded] = useState(false);

  async function add() {
    const res = await call<{ count: number; goodsValue: number; lines: { variantId: string; nameAr: string; nameEn: string; imageId: string | null }[] }>("/api/v1/cart/items", { body: { variantId, unitCode: unit, qty: Number(qty) } });
    if (res) {
      setAdded(true);
      const line = res.lines.find((l) => l.variantId === variantId);
      const u = units.find((x) => x.code === unit);
      cart.notifyAdded({
        name: productName ?? (line ? (locale === "ar" ? line.nameAr : line.nameEn) : ""),
        imageId: imageId ?? line?.imageId ?? null,
        qty: Number(qty),
        unitName: u ? (locale === "ar" ? u.nameAr : u.nameEn) : "",
        cartTotal: res.goodsValue,
        count: res.count,
      });
      setTimeout(() => setAdded(false), 2000);
    }
  }

  const name = (u: Unit) => (locale === "ar" ? u.nameAr : u.nameEn);
  const n = Math.max(0, Number(qty) || 0);
  const step = (d: number) => setQty(String(Math.max(minUnits, n + d)));

  // Kompakt (Produktkarten): Einheit, Mengen-Stepper − 1 + und runder Warenkorb-Knopf
  if (compact) {
    return (
      <div className="space-y-2">
        {units.length > 1 ? (
          <Select aria-label={t("unit")} value={unit} onChange={(e) => { setUnit(e.target.value); const f = units.find((u) => u.code === e.target.value)?.factor ?? 1; setQty(String(Math.max(1, Math.ceil(minQtyBase / f)))); }} className="w-full py-1.5 text-xs">
            {units.map((u) => (
              <option key={u.code} value={u.code}>{name(u)}{u.factor > 1 ? ` (${u.factor})` : ""}</option>
            ))}
          </Select>
        ) : null}
        <div className="flex items-center gap-1.5">
          <div className={cn("flex h-10 min-w-0 flex-1 items-center rounded-full bg-ink-50 ring-1 ring-ink-200", disabled && "opacity-50")}>
            <button type="button" onClick={() => step(-1)} disabled={disabled || n <= minUnits} className="grid size-9 shrink-0 place-items-center rounded-full text-lg font-semibold text-ink-700 disabled:text-ink-300" aria-label="−">−</button>
            <input
              inputMode="numeric"
              dir="ltr"
              aria-label={t("qty")}
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))}
              className="num w-full min-w-0 bg-transparent text-center text-sm font-bold text-ink-900 outline-none"
              data-testid="qty-input"
              disabled={disabled}
            />
            <button type="button" onClick={() => step(1)} disabled={disabled} className="grid size-9 shrink-0 place-items-center rounded-full text-lg font-semibold text-ink-700 disabled:text-ink-300" aria-label="+">+</button>
          </div>
          <button
            type="button"
            onClick={() => void add()}
            disabled={disabled || pending || n < 1}
            aria-label={t("add")}
            title={t("add")}
            className={cn("grid size-10 shrink-0 place-items-center rounded-full text-white shadow-sm transition active:scale-95 disabled:bg-ink-300", added ? "bg-green-600" : "bg-brand-700 hover:bg-brand-800")}
            data-testid="add-to-cart"
          >
            {added ? "✓" : (
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 3v6M11 6h6" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
        {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Input
          type="number"
          min={1}
          dir="ltr"
          aria-label={t("qty")}
          className={compact ? "num w-20 py-2" : "num w-24"}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          data-testid="qty-input"
        />
        {units.length > 1 ? (
          <Select aria-label={t("unit")} value={unit} onChange={(e) => { setUnit(e.target.value); const f = units.find((u) => u.code === e.target.value)?.factor ?? 1; setQty(String(Math.max(1, Math.ceil(minQtyBase / f)))); }} className={compact ? "w-auto py-2" : "w-auto"}>
            {units.map((u) => (
              <option key={u.code} value={u.code}>{name(u)}{u.factor > 1 ? ` (${u.factor})` : ""}</option>
            ))}
          </Select>
        ) : (
          <span className="self-center text-sm text-ink-600">{units[0] ? name(units[0]) : ""}</span>
        )}
        <Button onClick={() => void add()} className={added ? "bg-green-600 hover:bg-green-700" : undefined} disabled={disabled || pending || Number(qty) < 1} size={compact ? "sm" : "md"} data-testid="add-to-cart">
          {added ? `✓ ${t("added")}` : t("add")}
        </Button>
      </div>
      {minQtyBase > 1 || qtyStepBase > 1 ? <p className="text-xs text-ink-500">{t("qtyRule", { min: minQtyBase, step: qtyStepBase })}</p> : null}
      {error ? <Alert tone="red">{error}</Alert> : null}
    </div>
  );
}
