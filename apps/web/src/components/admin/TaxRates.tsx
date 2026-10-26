"use client";

import { formatBps, parsePercentToBps } from "@sa/core";
import { useFormatter, useTranslations } from "next-intl";
import { Alert, Badge, Button, Card, Field, Input, Num, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export interface TaxRateRow {
  id: string;
  code: string;
  rateBps: number;
  validFrom: string;
  validTo: string | null;
}

export function TaxRates({ rates, canEdit, now }: { rates: TaxRateRow[]; canEdit: boolean; now: string }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const nowMs = new Date(now).getTime();

  const state = (r: TaxRateRow) => {
    const from = new Date(r.validFrom).getTime();
    const to = r.validTo ? new Date(r.validTo).getTime() : Infinity;
    if (from > nowMs) return { label: t("planned"), tone: "blue" as const, future: true };
    if (to <= nowMs) return { label: t("expired"), tone: "neutral" as const, future: false };
    return { label: t("current"), tone: "green" as const, future: false };
  };

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let rateBps: number;
    try {
      rateBps = parsePercentToBps(String(fd.get("rate")));
    } catch {
      return setError(te("validation_error"));
    }
    // Server legt den Beginn auf 00:00 Ortszeit (Asia/Hebron)
    const res = await call("/api/v1/admin/settings/tax-rates", { body: { code: "STANDARD", rateBps, validFrom: String(fd.get("validFrom")) } });
    if (res) {
      e.currentTarget?.reset();
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (await call(`/api/v1/admin/settings/tax-rates/${id}`, { method: "DELETE" })) router.refresh();
  }

  return (
    <div className="space-y-6">
      <Alert tone="blue">{t("taxNote")}</Alert>
      {error ? <Alert tone="red">{error}</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>{t("taxCode")}</Th>
            <Th>{t("rate")}</Th>
            <Th>{t("validFrom")}</Th>
            <Th>{t("validTo")}</Th>
            <Th>{tc("status")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rates.map((r) => {
            const s = state(r);
            return (
              <tr key={r.id}>
                <Td><Num>{r.code}</Num></Td>
                <Td><Num>{formatBps(r.rateBps)}</Num></Td>
                <Td><Num>{format.dateTime(new Date(r.validFrom), "short")}</Num></Td>
                <Td><Num>{r.validTo ? format.dateTime(new Date(r.validTo), "short") : "–"}</Num></Td>
                <Td><Badge tone={s.tone}>{s.label}</Badge></Td>
                <Td>{canEdit && s.future ? <Button size="sm" variant="danger" disabled={pending} onClick={() => void remove(r.id)}>{tc("delete")}</Button> : null}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {canEdit ? (
        <Card title={t("newRate")}>
          <form onSubmit={add} className="flex flex-wrap items-end gap-3">
            <Field label={`${t("rate")} (%)`} htmlFor="rate"><Input id="rate" name="rate" dir="ltr" className="num w-28" required /></Field>
            <Field label={t("validFrom")} htmlFor="validFrom"><Input id="validFrom" name="validFrom" type="date" dir="ltr" className="num" required /></Field>
            <Button type="submit" disabled={pending}>{tc("add")}</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
