"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

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
}: {
  variantId: string;
  units: Unit[];
  defaultUnit: string;
  minQtyBase: number;
  qtyStepBase: number;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("shop.cart");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [unit, setUnit] = useState(defaultUnit);
  const factor = units.find((u) => u.code === unit)?.factor ?? 1;
  const minUnits = Math.max(1, Math.ceil(minQtyBase / factor));
  const [qty, setQty] = useState(String(minUnits));
  const [added, setAdded] = useState(false);

  async function add() {
    const res = await call("/api/v1/cart/items", { body: { variantId, unitCode: unit, qty: Number(qty) } });
    if (res) {
      setAdded(true);
      router.refresh();
      setTimeout(() => setAdded(false), 2500);
    }
  }

  const name = (u: Unit) => (locale === "ar" ? u.nameAr : u.nameEn);
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
        <Button onClick={() => void add()} disabled={disabled || pending || Number(qty) < 1} size={compact ? "sm" : "md"} data-testid="add-to-cart">
          {added ? t("added") : t("add")}
        </Button>
      </div>
      {minQtyBase > 1 || qtyStepBase > 1 ? <p className="text-xs text-ink-500">{t("qtyRule", { min: minQtyBase, step: qtyStepBase })}</p> : null}
      {error ? <Alert tone="red">{error}</Alert> : null}
    </div>
  );
}
