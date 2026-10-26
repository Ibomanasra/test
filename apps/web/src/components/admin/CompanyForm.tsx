"use client";

import { formatBps, parsePercentToBps } from "@sa/core";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export interface CompanyValues {
  nameAr: string;
  nameEn: string;
  addressAr: string;
  addressEn: string;
  phone: string;
  email: string | null;
  website: string | null;
  dealerNumber: string;
  taxFileNumber: string | null;
  minMarginBps: number;
  defaultPaymentTermDays: number;
  quoteValidityDays: number;
}

export function CompanyForm({ values, canEdit }: { values: CompanyValues; canEdit: boolean }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const { call, pending, error, setError } = useApi();
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    let minMarginBps: number;
    try {
      minMarginBps = parsePercentToBps(s("minMargin"));
    } catch {
      return setError(te("validation_error"));
    }
    const res = await call("/api/v1/admin/settings/company", {
      method: "PUT",
      body: {
        nameAr: s("nameAr"),
        nameEn: s("nameEn"),
        addressAr: s("addressAr"),
        addressEn: s("addressEn"),
        phone: s("phone"),
        email: s("email"),
        website: s("website") || undefined,
        dealerNumber: s("dealerNumber"),
        taxFileNumber: s("taxFileNumber") || undefined,
        minMarginBps,
        defaultPaymentTermDays: Number(s("defaultPaymentTermDays")),
        quoteValidityDays: Number(s("quoteValidityDays")),
      },
    });
    if (res) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <fieldset disabled={!canEdit} className="contents">
          <Field label={t("nameAr")} htmlFor="nameAr"><Input id="nameAr" name="nameAr" dir="rtl" defaultValue={values.nameAr} required /></Field>
          <Field label={t("nameEn")} htmlFor="nameEn"><Input id="nameEn" name="nameEn" dir="ltr" defaultValue={values.nameEn} required /></Field>
          <Field label={t("addressAr")} htmlFor="addressAr"><Textarea id="addressAr" name="addressAr" dir="rtl" defaultValue={values.addressAr} required /></Field>
          <Field label={t("addressEn")} htmlFor="addressEn"><Textarea id="addressEn" name="addressEn" dir="ltr" defaultValue={values.addressEn} required /></Field>
          <Field label={tc("phone")} htmlFor="phone"><Input id="phone" name="phone" dir="ltr" className="num" defaultValue={values.phone} required /></Field>
          <Field label={tc("email")} htmlFor="email"><Input id="email" name="email" type="email" dir="ltr" defaultValue={values.email ?? ""} /></Field>
          <Field label={t("website")} htmlFor="website"><Input id="website" name="website" dir="ltr" defaultValue={values.website ?? ""} /></Field>
          <Field label={t("dealerNumber")} htmlFor="dealerNumber"><Input id="dealerNumber" name="dealerNumber" dir="ltr" className="num" defaultValue={values.dealerNumber} required /></Field>
          <Field label={t("taxFileNumber")} htmlFor="taxFileNumber"><Input id="taxFileNumber" name="taxFileNumber" dir="ltr" className="num" defaultValue={values.taxFileNumber ?? ""} /></Field>
          <Field label={t("minMargin")} htmlFor="minMargin"><Input id="minMargin" name="minMargin" dir="ltr" className="num" defaultValue={formatBps(values.minMarginBps).replace("%", "")} required /></Field>
          <Field label={t("defaultPaymentTerms")} htmlFor="defaultPaymentTermDays"><Input id="defaultPaymentTermDays" name="defaultPaymentTermDays" type="number" min={0} max={365} dir="ltr" className="num" defaultValue={values.defaultPaymentTermDays} required /></Field>
          <Field label={t("quoteValidity")} htmlFor="quoteValidityDays"><Input id="quoteValidityDays" name="quoteValidityDays" type="number" min={1} max={365} dir="ltr" className="num" defaultValue={values.quoteValidityDays} required /></Field>
        </fieldset>
        <div className="space-y-3 sm:col-span-2">
          {error ? <Alert tone="red">{error}</Alert> : null}
          {saved ? <Alert tone="green">{tc("saved")}</Alert> : null}
          {canEdit ? <Button type="submit" disabled={pending}>{tc("save")}</Button> : null}
        </div>
      </form>
    </Card>
  );
}
