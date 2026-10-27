"use client";

import { formatMoney } from "@sa/core";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Input, Table, Td, Th } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import type { PricedCart } from "@/server/services/cart";

export function CartView({ cart, loggedIn, isB2B }: { cart: PricedCart; loggedIn: boolean; isB2B: boolean }) {
  const t = useTranslations("shop.cart");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [listName, setListName] = useState("");
  const [saved, setSaved] = useState(false);

  async function setQty(id: string, qty: number) {
    if (await call(`/api/v1/cart/items/${id}`, { method: "PATCH", body: { qty } })) router.refresh();
  }
  async function saveList() {
    if (await call("/api/v1/lists", { body: { name: listName } })) {
      setSaved(true);
      setListName("");
    }
  }

  const nm = (a: string | null, e: string | null) => (locale === "ar" ? a : e);
  if (cart.lines.length === 0) {
    return (
      <Card>
        <p className="text-ink-600">{t("empty")}</p>
        <Link href="/products" className="mt-3 inline-block text-brand-700 underline">{t("continue")}</Link>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {cart.quoteId ? <Alert tone="blue">{t("quoteApplied")}</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>{t("product")}</Th>
            <Th>{t("qty")}</Th>
            <Th>{cart.channel === "B2B" ? t("unitNet") : t("unitGross")}</Th>
            <Th>{t("lineTotal")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {cart.lines.map((l) => (
            <tr key={l.id} data-testid="cart-line" className={l.problem ? "bg-amber-50" : undefined}>
              <Td>
                <Link href={`/products/${l.productSlug}`} className="font-medium hover:underline">{nm(l.nameAr, l.nameEn)}</Link>
                {nm(l.variantNameAr, l.variantNameEn) ? <span className="text-ink-600"> – {nm(l.variantNameAr, l.variantNameEn)}</span> : null}
                <p className="num text-xs text-ink-500">{l.sku}</p>
                {l.freeQtyBase > 0 ? <p className="text-xs text-green-700">{t("freeUnits", { count: l.freeQtyBase })}</p> : null}
                {l.problem ? <p className="text-xs text-amber-800">{t(`problems.${l.problem}`, { min: l.minQtyBase, step: l.qtyStepBase, available: Math.max(0, l.availableBase) })}</p> : null}
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    dir="ltr"
                    className="num w-20 py-1.5"
                    defaultValue={l.qty}
                    aria-label={t("qty")}
                    onBlur={(e) => Number(e.target.value) !== l.qty && void setQty(l.id, Number(e.target.value))}
                  />
                  <span className="text-sm whitespace-nowrap">{locale === "ar" ? l.unitNameAr : l.unitNameEn}{l.factor > 1 ? ` (${l.factor})` : ""}</span>
                </div>
              </Td>
              <Td className="num">{formatMoney(l.unitPrice)}</Td>
              <Td className="num font-medium">{formatMoney(l.lineTotal)}</Td>
              <Td><Button size="sm" variant="ghost" onClick={() => void setQty(l.id, 0)} disabled={pending} aria-label={tc("delete")}>✕</Button></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {error ? <Alert tone="red">{error}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          {isB2B ? (
            <Card title={t("saveAsList")}>
              <form method="post" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void saveList(); }}>
                <Input value={listName} onChange={(e) => setListName(e.target.value)} placeholder={t("listName")} required minLength={2} />
                <Button type="submit" variant="secondary" disabled={pending}>{tc("save")}</Button>
              </form>
              {saved ? <p className="mt-2 text-sm text-green-700">{t("listSaved")}</p> : null}
            </Card>
          ) : null}
        </div>
        <Card>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between"><span>{cart.channel === "B2B" ? t("goodsNet") : t("goodsGross")}</span><span className="num font-semibold">{formatMoney(cart.goodsValue)}</span></p>
            <p className="flex justify-between text-ink-500"><span>{t("vatIncluded")}</span><span className="num">{formatMoney(cart.vat)}</span></p>
            <p className="flex justify-between font-semibold"><span>{t("totalGross")}</span><span className="num">{formatMoney(cart.gross)}</span></p>
            <p className="text-xs text-ink-500">{t("deliveryAtCheckout")}</p>
          </div>
          <div className="mt-4">
            {cart.hasProblems ? <Alert tone="amber">{t("fixProblems")}</Alert> : loggedIn ? (
              <Button className="w-full" onClick={() => router.push("/checkout")} data-testid="to-checkout">{t("checkout")}</Button>
            ) : (
              <Button className="w-full" onClick={() => router.push("/login?next=/checkout")}>{t("loginToCheckout")}</Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
