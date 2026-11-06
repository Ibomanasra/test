"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { Field, Input, Select } from "@/components/ui";
import { PLACE_SUGGESTIONS } from "@/lib/places";

/**
 * Ort frei eingeben (mit Vorschlägen) + optionale Lieferzone.
 * Ohne Auswahl ordnet der Server die Zone über den Ort zu, sonst „مناطق أخرى“.
 */
export function CityZoneFields({
  zones,
  idPrefix = "",
  defaultCity,
  defaultZoneId,
}: {
  zones: { id: string; name: string }[];
  idPrefix?: string;
  defaultCity?: string;
  defaultZoneId?: string;
}) {
  const t = useTranslations("register");
  const locale = useLocale();
  const listId = useId();
  return (
    <>
      <Field label={t("city")} htmlFor={`${idPrefix}city`} hint={t("cityHint")}>
        <Input id={`${idPrefix}city`} name="city" required minLength={2} autoComplete="address-level2" list={listId} defaultValue={defaultCity} />
        <datalist id={listId}>
          {PLACE_SUGGESTIONS.map((p) => <option key={p.en} value={locale === "ar" ? p.ar : p.en} />)}
        </datalist>
      </Field>
      <Field label={t("zoneOptional")} htmlFor={`${idPrefix}zoneId`}>
        <Select id={`${idPrefix}zoneId`} name="zoneId" defaultValue={defaultZoneId ?? ""}>
          <option value="">{t("zoneAuto")}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </Select>
      </Field>
    </>
  );
}
