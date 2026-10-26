"use client";

import { formatMoney, parseShekel } from "@sa/core";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

interface Group {
  id: string;
  name: string;
  defaultPaymentTermDays: number | null;
  defaultCreditLimitAgorot: number | null;
}

export interface CustomerActionsProps {
  customerId: string;
  type: "B2C" | "B2B";
  status: "ACTIVE" | "PENDING_APPROVAL" | "REJECTED" | "BLOCKED";
  groups: Group[];
  current: { groupId: string | null; paymentTermDays: number | null; creditLimitAgorot: number; allowOnAccount: boolean };
  defaultPaymentTermDays: number;
  can: { approve: boolean; credit: boolean; block: boolean; note: boolean };
}

export function CustomerActions(p: CustomerActionsProps) {
  const t = useTranslations("admin.customers");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const firstGroup = p.groups[0];
  const [groupId, setGroupId] = useState(p.current.groupId ?? firstGroup?.id ?? "");
  const group = p.groups.find((g) => g.id === groupId);
  const [terms, setTerms] = useState(String(p.current.paymentTermDays ?? group?.defaultPaymentTermDays ?? p.defaultPaymentTermDays));
  const [credit, setCredit] = useState(
    formatMoney(p.current.creditLimitAgorot || group?.defaultCreditLimitAgorot || 0, { symbol: false, grouping: false }),
  );
  const [onAccount, setOnAccount] = useState(p.current.allowOnAccount || p.status === "PENDING_APPROVAL");

  async function post(path: string, body?: unknown, method = "POST") {
    const res = await call(`/api/v1/admin/customers/${p.customerId}/${path}`, { method, body: body ?? {} });
    if (res) {
      setReason("");
      setNote("");
      router.refresh();
    }
  }

  function creditBody() {
    let creditLimitAgorot: number;
    try {
      creditLimitAgorot = parseShekel(credit);
    } catch {
      setError(te("invalid_amount"));
      return null;
    }
    return { groupId, paymentTermDays: Number(terms), creditLimitAgorot, allowOnAccount: onAccount };
  }

  const isPending = p.status === "PENDING_APPROVAL" || p.status === "REJECTED";
  const showCredit = p.type === "B2B" && ((isPending && p.can.approve && p.can.credit) || (!isPending && p.can.credit));

  return (
    <div className="space-y-6">
      {error ? <Alert tone="red">{error}</Alert> : null}

      {showCredit ? (
        <Card title={isPending ? t("approveTitle") : t("creditTitle")}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const body = creditBody();
              if (body) void post(isPending ? "approve" : "credit", body, isPending ? "POST" : "PUT");
            }}
          >
            <Field label={t("group")} htmlFor="groupId">
              <Select id="groupId" value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
                {p.groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("paymentTermDays")} htmlFor="terms">
              <Input id="terms" type="number" min={0} max={365} dir="ltr" className="num" value={terms} onChange={(e) => setTerms(e.target.value)} required />
            </Field>
            <Field label={t("creditLimit")} htmlFor="credit">
              <Input id="credit" inputMode="decimal" dir="ltr" className="num" value={credit} onChange={(e) => setCredit(e.target.value)} required />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" checked={onAccount} onChange={(e) => setOnAccount(e.target.checked)} className="size-4 accent-brand-700" />
              {t("allowOnAccount")}
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending} data-testid={isPending ? "approve-button" : "save-credit"}>
                {isPending ? t("approve") : tc("save")}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {p.type === "B2B" && p.status === "PENDING_APPROVAL" && p.can.approve ? (
        <Card title={t("reject")}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void post("reject", { reason }); }}>
            <Field label={t("rejectReason")} htmlFor="rejectReason">
              <Textarea id="rejectReason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
            </Field>
            <Button type="submit" variant="danger" disabled={pending}>{t("reject")}</Button>
          </form>
        </Card>
      ) : null}

      {p.can.block ? (
        p.status === "BLOCKED" ? (
          <Button variant="secondary" disabled={pending} onClick={() => void post("unblock")}>{t("unblock")}</Button>
        ) : (
          <Card title={t("block")}>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void post("block", { reason }); }}>
              <Field label={t("blockReason")} htmlFor="blockReason">
                <Input id="blockReason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
              </Field>
              <Button type="submit" variant="danger" disabled={pending}>{t("block")}</Button>
            </form>
          </Card>
        )
      ) : null}

      {p.can.note ? (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void post("notes", { body: note }); }}>
          <Field label={t("addNote")} htmlFor="note">
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} required />
          </Field>
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>{tc("add")}</Button>
        </form>
      ) : null}
    </div>
  );
}
