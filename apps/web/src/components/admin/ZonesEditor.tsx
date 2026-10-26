"use client";

import { formatMoney, parseShekel } from "@sa/core";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Money, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

type Channel = "B2C" | "B2B";
export interface ZoneRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  active: boolean;
  sortOrder: number;
  deliveryWeekdays: number[];
  rates: { channel: Channel; feeGrossAgorot: number; minOrderAgorot: number; freeFromAgorot: number | null }[];
}

const CHANNELS: Channel[] = ["B2C", "B2B"];
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function ZonesEditor({ zones, canEdit, locale }: { zones: ZoneRow[]; canEdit: boolean; locale: string }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const te = useTranslations("errors");
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const [editing, setEditing] = useState<ZoneRow | "new" | null>(null);

  const money = (v: number | null | undefined) => (v == null ? "" : formatMoney(v, { symbol: false, grouping: false }));

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    try {
      const rates = CHANNELS.map((ch) => ({
        channel: ch,
        feeGrossAgorot: parseShekel(s(`${ch}-fee`) || "0"),
        minOrderAgorot: parseShekel(s(`${ch}-min`) || "0"),
        freeFromAgorot: s(`${ch}-free`) ? parseShekel(s(`${ch}-free`)) : null,
      }));
      const body = {
        code: s("code").toUpperCase(),
        nameAr: s("nameAr"),
        nameEn: s("nameEn"),
        active: fd.get("active") === "on",
        sortOrder: Number(s("sortOrder") || 0),
        deliveryWeekdays: fd.getAll("weekday").map(Number),
        rates,
      };
      const res =
        editing === "new"
          ? await call("/api/v1/admin/settings/zones", { body })
          : await call(`/api/v1/admin/settings/zones/${(editing as ZoneRow).id}`, { method: "PUT", body });
      if (res) {
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError(te("invalid_amount"));
    }
  }

  const rateOf = (z: ZoneRow | "new", ch: Channel) => (z === "new" ? undefined : z.rates.find((r) => r.channel === ch));

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>{t("newZone")}</Button>
        </div>
      ) : null}
      {error ? <Alert tone="red">{error}</Alert> : null}

      {editing ? (
        <Card title={editing === "new" ? t("newZone") : locale === "ar" ? editing.nameAr : editing.nameEn}>
          <form onSubmit={save} className="space-y-4" key={editing === "new" ? "new" : editing.id}>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label={t("zoneCode")} htmlFor="code"><Input id="code" name="code" dir="ltr" className="num uppercase" required pattern="[A-Za-z0-9_]{2,30}" defaultValue={editing === "new" ? "" : editing.code} /></Field>
              <Field label={t("nameAr")} htmlFor="nameAr"><Input id="nameAr" name="nameAr" dir="rtl" required defaultValue={editing === "new" ? "" : editing.nameAr} /></Field>
              <Field label={t("nameEn")} htmlFor="nameEn"><Input id="nameEn" name="nameEn" dir="ltr" required defaultValue={editing === "new" ? "" : editing.nameEn} /></Field>
              <Field label={t("sortOrder")} htmlFor="sortOrder"><Input id="sortOrder" name="sortOrder" type="number" min={0} dir="ltr" className="num" defaultValue={editing === "new" ? 0 : editing.sortOrder} /></Field>
            </div>
            {CHANNELS.map((ch) => (
              <fieldset key={ch} className="grid gap-4 rounded-lg bg-ink-50 p-3 sm:grid-cols-3">
                <legend className="px-1 text-sm font-semibold">{tAll(`channel.${ch}`)}</legend>
                <Field label={t("fee")} htmlFor={`${ch}-fee`}><Input id={`${ch}-fee`} name={`${ch}-fee`} inputMode="decimal" dir="ltr" className="num" defaultValue={money(rateOf(editing, ch)?.feeGrossAgorot ?? 0)} /></Field>
                <Field label={t("minOrder")} htmlFor={`${ch}-min`}><Input id={`${ch}-min`} name={`${ch}-min`} inputMode="decimal" dir="ltr" className="num" defaultValue={money(rateOf(editing, ch)?.minOrderAgorot ?? 0)} /></Field>
                <Field label={t("freeFrom")} htmlFor={`${ch}-free`}><Input id={`${ch}-free`} name={`${ch}-free`} inputMode="decimal" dir="ltr" className="num" defaultValue={money(rateOf(editing, ch)?.freeFromAgorot)} /></Field>
              </fieldset>
            ))}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink-700">{t("weekdays")} <span className="text-ink-400">({t("everyDay")} = –)</span></legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <label key={d} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ring-1 ring-ink-200">
                    <input type="checkbox" name="weekday" value={d} defaultChecked={editing !== "new" && editing.deliveryWeekdays.includes(d)} className="accent-brand-700" />
                    {tAll(`weekday.${d}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={editing === "new" ? true : editing.active} className="size-4 accent-brand-700" />
              {tc("active")}
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>{tc("save")}</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>{tc("cancel")}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Table>
        <thead>
          <tr>
            <Th>{tc("name")}</Th>
            {CHANNELS.map((ch) => (
              <Th key={ch}>{tAll(`channel.${ch}`)}</Th>
            ))}
            <Th>{t("weekdays")}</Th>
            <Th>{tc("status")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {zones.map((z) => (
            <tr key={z.id} data-testid="zone-row">
              <Td>
                <p className="font-medium">{locale === "ar" ? z.nameAr : z.nameEn}</p>
                <p className="num text-xs text-ink-500">{z.code}</p>
              </Td>
              {CHANNELS.map((ch) => {
                const r = z.rates.find((x) => x.channel === ch);
                return (
                  <Td key={ch} className="text-xs whitespace-nowrap">
                    {r ? (
                      <div className="space-y-0.5">
                        <div>{t("fee")}: <Money agorot={r.feeGrossAgorot} /></div>
                        <div>{t("minOrder")}: <Money agorot={r.minOrderAgorot} /></div>
                        <div>{t("freeFrom")}: {r.freeFromAgorot != null ? <Money agorot={r.freeFromAgorot} /> : "–"}</div>
                      </div>
                    ) : "–"}
                  </Td>
                );
              })}
              <Td className="text-xs">{z.deliveryWeekdays.length ? z.deliveryWeekdays.map((d) => tAll(`weekday.${d}`)).join("، ") : t("everyDay")}</Td>
              <Td><Badge tone={z.active ? "green" : "neutral"}>{z.active ? tc("active") : tc("inactive")}</Badge></Td>
              <Td>{canEdit ? <Button size="sm" variant="secondary" onClick={() => setEditing(z)}>{tc("edit")}</Button> : null}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
