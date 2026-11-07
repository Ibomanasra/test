"use client";

import { formatMoney } from "@sa/core";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, EmptyState, Input, cn } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

interface Item {
  id: string;
  orderId: string;
  orderNumber: string;
  customer: string;
  tracking: string;
  deliveredAt: string;
  amount: number;
}
interface Account {
  id: string;
  name: string;
  phone: string;
  owed: number;
  onTheWay: number;
  onTheWayCount: number;
  items: Item[];
  settlements: { id: string; at: string; amount: number; count: number; note: string }[];
}

/** Abrechnung je Zustellfirma: kassiertes Geld auswählen → „Geld erhalten“ */
export function CourierAccounts({ accounts, canSettle }: { accounts: Account[]; canSettle: boolean }) {
  const t = useTranslations("admin.finance.couriers");
  if (!accounts.length) return <EmptyState>{t("none")}</EmptyState>;
  return (
    <div className="space-y-6">
      <Alert tone="blue">{t("intro")}</Alert>
      {accounts.map((a) => <CourierCard key={a.id} a={a} canSettle={canSettle} />)}
    </div>
  );
}

function CourierCard({ a, canSettle }: { a: Account; canSettle: boolean }) {
  const t = useTranslations("admin.finance.couriers");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [sel, setSel] = useState<Set<string>>(() => new Set(a.items.map((i) => i.id)));
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const total = a.items.filter((i) => sel.has(i.id)).reduce((s, i) => s + i.amount, 0);
  const toggle = (id: string) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function settle() {
    const r = await call<{ amount: number; count: number }>(`/api/v1/admin/delivery-companies/${a.id}/settle`, { body: { shipmentIds: [...sel], note: note || undefined } });
    if (r) {
      setDone(t("settled", { amount: formatMoney(r.amount), count: r.count }));
      setNote("");
      router.refresh();
    }
  }

  return (
    <Card>
      <div data-testid="courier-account">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900">🚚 {a.name}</h2>
            {a.phone ? <a href={`tel:${a.phone}`} className="num text-sm text-brand-700" dir="ltr">{a.phone}</a> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-ink-50 px-4 py-2 text-end">
              <p className="text-xs text-ink-500">{t("onTheWay", { count: a.onTheWayCount })}</p>
              <p className="num font-semibold text-ink-800">{formatMoney(a.onTheWay)}</p>
            </div>
            <div className={cn("rounded-xl px-4 py-2 text-end", a.owed > 0 ? "bg-amber-100" : "bg-green-50")}>
              <p className="text-xs text-ink-600">{t("owes")}</p>
              <p className="num text-xl font-bold text-ink-900" data-testid="courier-owed">{formatMoney(a.owed)}</p>
            </div>
          </div>
        </div>

        {a.items.length ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-ink-800">{t("collectedList")}</p>
            <ul className="divide-y divide-ink-100 rounded-xl ring-1 ring-ink-200">
              {a.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  {canSettle ? <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} className="size-5 accent-brand-700" aria-label={i.orderNumber} /> : null}
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/orders/${i.orderId}`} className="num font-medium text-ink-900 hover:underline">{i.orderNumber}</Link>
                    <span className="text-ink-600"> · {i.customer}</span>
                    <p className="num text-xs text-ink-500">{i.deliveredAt}{i.tracking ? ` · #${i.tracking}` : ""}</p>
                  </div>
                  <span className="num font-semibold">{formatMoney(i.amount)}</span>
                </li>
              ))}
            </ul>
            {canSettle ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} className="max-w-xs" aria-label={t("notePlaceholder")} />
                <Button disabled={pending || total <= 0} onClick={() => void settle()} data-testid="courier-settle">
                  ✓ {t("received", { amount: formatMoney(total) })}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-green-700">✓ {t("nothingOwed")}</p>
        )}
        {error ? <div className="mt-3"><Alert tone="red">{error}</Alert></div> : null}
        {done ? <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status">{done}</p> : null}

        {a.settlements.length ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-ink-600">{t("history")}</summary>
            <ul className="mt-2 space-y-1">
              {a.settlements.map((x) => (
                <li key={x.id} className="flex justify-between gap-3 text-ink-700">
                  <span className="num">{x.at} · {t("ordersCount", { count: x.count })}{x.note ? ` · ${x.note}` : ""}</span>
                  <span className="num font-medium">{formatMoney(x.amount)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Card>
  );
}
