"use client";

import { formatMoney, parseShekel } from "@sa/core";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { Alert, Button, Card, Field, Input, cn } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export interface PayCustomer {
  id: string;
  name: string;
  number: string;
  open: number;
}

interface OpenInvoice {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  total: number;
  open: number;
  daysOverdue: number;
}

type Method = "CASH_ON_DELIVERY" | "BANK_TRANSFER" | "CARD_GATEWAY";
const METHODS: { key: Method; icon: "cash" | "money" | "file" }[] = [
  { key: "CASH_ON_DELIVERY", icon: "cash" },
  { key: "BANK_TRANSFER", icon: "money" },
  { key: "CARD_GATEWAY", icon: "file" },
];
const fmt = (a: number) => formatMoney(a);

/**
 * Zahlung erfassen in drei Schritten: Wer zahlt? → Welche Rechnungen? → Wie viel und wie?
 * Ohne Auswahl verteilt der Server auf die ältesten Rechnungen.
 */
export function PaymentWizard({ customers, initialCustomerId, onDone }: { customers: PayCustomer[]; initialCustomerId?: string; onDone?: () => void }) {
  const t = useTranslations("admin.finance.pay");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<OpenInvoice[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("CASH_ON_DELIVERY");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");
  const [done, setDone] = useState<{ id: string; number: string; unallocated: number } | null>(null);

  const customer = customers.find((c) => c.id === customerId);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.number.toLowerCase().includes(q)) : customers.filter((c) => c.open > 0);
    return list.slice(0, 8);
  }, [customers, search]);

  function selectCustomer(id: string) {
    setInvoices(null);
    setPicked([]);
    setAmount("");
    setCustomerId(id);
  }

  useEffect(() => {
    if (!customerId) return;
    let alive = true;
    void call<{ items: OpenInvoice[] }>(`/api/v1/admin/customers/${customerId}/open-invoices`).then((r) => {
      if (alive && r) setInvoices(r.items);
    });
    return () => {
      alive = false;
    };
  }, [customerId, call]);

  const openTotal = invoices?.reduce((a, i) => a + i.open, 0) ?? 0;
  const pickedTotal = invoices?.filter((i) => picked.includes(i.id)).reduce((a, i) => a + i.open, 0) ?? 0;

  function toggle(id: string) {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next);
    const sum = invoices?.filter((i) => next.includes(i.id)).reduce((a, i) => a + i.open, 0) ?? 0;
    setAmount(sum ? formatMoney(sum, { symbol: false, grouping: false }) : "");
  }

  async function submit() {
    let agorot: number;
    try {
      agorot = parseShekel(amount);
    } catch {
      return setError(te("invalid_amount"));
    }
    if (agorot <= 0) return setError(te("invalid_amount"));
    const res = await call<{ id: string; number: string; unallocated: number }>("/api/v1/admin/payments", {
      body: { customerId, method, amount: agorot, reference: reference || undefined, receivedAt: date || undefined, invoiceIds: picked.length ? picked : undefined },
    });
    if (res) {
      setDone(res);
      router.refresh();
    }
  }

  function reset() {
    setDone(null);
    setCustomerId("");
    setSearch("");
    setAmount("");
    setReference("");
    setDate("");
    onDone?.();
  }

  if (done) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-4 text-center" data-testid="pay-done">
          <span className="grid size-12 place-items-center rounded-full bg-green-100 text-green-700"><Icon name="check" className="size-6" /></span>
          <p className="text-lg font-semibold text-ink-900">{t("doneTitle")}</p>
          <p className="text-sm text-ink-600">
            <span className="num">{done.number}</span> · {customer?.name}
          </p>
          {done.unallocated > 0 ? <p className="text-sm text-amber-800">{t("unallocated", { amount: fmt(done.unallocated) })}</p> : null}
          <div className="flex flex-wrap justify-center gap-2">
            <a href={`/api/v1/documents/receipt/${done.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-ink-300 hover:bg-ink-50">
              <Icon name="print" className="size-4" /> {t("printReceipt")}
            </a>
            <Button variant="secondary" onClick={reset}>{t("another")}</Button>
          </div>
        </div>
      </Card>
    );
  }

  const step = (n: number, title: string, active: boolean) => (
    <p className={cn("mb-3 flex items-center gap-2 text-sm font-semibold", active ? "text-ink-900" : "text-ink-400")}>
      <span className={cn("num grid size-6 place-items-center rounded-full text-xs", active ? "bg-brand-700 text-white" : "bg-ink-100 text-ink-500")}>{n}</span>
      {title}
    </p>
  );

  return (
    <Card title={t("title")}>
      <div className="grid gap-6 lg:grid-cols-3" data-testid="pay-wizard">
        {/* 1. Kunde */}
        <div>
          {step(1, t("step1"), true)}
          {customer ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200">
              <div>
                <p className="font-medium text-ink-900">{customer.name}</p>
                <p className="num text-xs text-ink-500">{customer.number}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => selectCustomer("")}>{t("change")}</Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchCustomer")} className="ps-9" data-testid="pay-search" autoFocus />
              </div>
              {!search ? <p className="mt-2 text-xs text-ink-500">{t("debtorsFirst")}</p> : null}
              <ul className="mt-2 divide-y divide-ink-100 rounded-xl ring-1 ring-ink-200">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => selectCustomer(c.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-ink-50" data-testid="pay-customer">
                      <span>{c.name} <span className="num text-xs text-ink-400">{c.number}</span></span>
                      {c.open > 0 ? <span className="num text-xs font-semibold text-red-700">{fmt(c.open)}</span> : null}
                    </button>
                  </li>
                ))}
                {matches.length === 0 ? <li className="px-3 py-2 text-sm text-ink-500">{tc("noResults")}</li> : null}
              </ul>
            </>
          )}
        </div>

        {/* 2. Rechnungen */}
        <div>
          {step(2, t("step2"), Boolean(customer))}
          {!customer ? null : invoices == null ? (
            <p className="text-sm text-ink-500">…</p>
          ) : invoices.length === 0 ? (
            <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{t("noOpen")}</p>
          ) : (
            <>
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {invoices.map((i) => (
                  <li key={i.id}>
                    <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 transition", picked.includes(i.id) ? "bg-brand-50 ring-brand-300" : "ring-ink-200 hover:bg-ink-50")}>
                      <input type="checkbox" checked={picked.includes(i.id)} onChange={() => toggle(i.id)} className="size-4 accent-brand-700" />
                      <span className="flex-1">
                        <span className="num block text-sm font-medium">{i.number}</span>
                        <span className={cn("num text-xs", i.daysOverdue > 0 ? "text-red-700" : "text-ink-500")}>
                          {i.daysOverdue > 0 ? t("overdueDays", { days: i.daysOverdue }) : t("due", { date: i.dueDate })}
                        </span>
                      </span>
                      <span className="num text-sm font-semibold">{fmt(i.open)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
                <span>{picked.length ? t("pickedSum", { amount: fmt(pickedTotal) }) : t("autoOldest")}</span>
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => { setPicked([]); setAmount(formatMoney(openTotal, { symbol: false, grouping: false })); }}>
                  {t("payAll", { amount: fmt(openTotal) })}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 3. Betrag & Art */}
        <div>
          {step(3, t("step3"), Boolean(customer))}
          {customer ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" className="num flex-1 text-center text-lg font-semibold" placeholder="0.00" aria-label={t("amount")} data-testid="pay-amount" />
                <span className="text-lg text-ink-500">₪</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethod(m.key)}
                    className={cn("flex flex-col items-center gap-1 rounded-xl p-2.5 text-xs font-medium ring-1 transition", method === m.key ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:bg-ink-50")}
                  >
                    <Icon name={m.icon} className="size-5" />
                    {t(`method.${m.key}`)}
                  </button>
                ))}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-ink-600">{t("more")}</summary>
                <div className="mt-2 grid gap-2">
                  <Field label={t("reference")} htmlFor="pay-ref"><Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" className="text-start" /></Field>
                  <Field label={t("date")} htmlFor="pay-date"><Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className="num" /></Field>
                </div>
              </details>
              {error ? <Alert tone="red">{error}</Alert> : null}
              <Button className="w-full" disabled={pending || !amount} onClick={() => void submit()} data-testid="pay-submit">
                <Icon name="check" className="size-4" /> {t("submit")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
