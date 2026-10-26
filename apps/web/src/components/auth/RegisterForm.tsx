"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Field, Input, Select, cn } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, useApi } from "@/lib/api-client";
import { useHydrated } from "@/lib/use-hydrated";

interface Zone {
  id: string;
  name: string;
}

export function RegisterForm({
  token,
  zones,
  initialType,
  maxUploadMb,
}: {
  token: string;
  zones: Zone[];
  initialType: "b2c" | "b2b";
  maxUploadMb: number;
}) {
  const t = useTranslations("register");
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const { run, pending, error } = useApi();
  const [type, setType] = useState<"b2c" | "b2b">(initialType);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const address = { zoneId: s("zoneId"), city: s("city"), street: s("street") || undefined, details: s("details") || undefined };
    const ok = await run(async () => {
      if (type === "b2c") {
        return apiFetch("/api/v1/auth/register/b2c", {
          locale,
          body: { registrationToken: token, name: s("name"), locale, address },
        });
      }
      const form = new FormData();
      form.set(
        "data",
        JSON.stringify({
          registrationToken: token,
          name: s("ownerName"),
          locale,
          companyName: s("companyName"),
          ownerName: s("ownerName"),
          dealerNumber: s("dealerNumber"),
          email: s("email"),
          address,
        }),
      );
      const file = fd.get("license");
      if (file instanceof File && file.size > 0) form.set("license", file);
      return apiFetch("/api/v1/auth/register/b2b", { locale, form });
    });
    if (ok) {
      router.replace("/account");
      router.refresh();
    }
  }

  const typeCard = (value: "b2c" | "b2b", title: string, text: string) => (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-xl p-4 ring-1 transition",
        type === value ? "bg-brand-50 ring-2 ring-brand-600" : "bg-white ring-ink-200 hover:ring-ink-300",
      )}
    >
      <input type="radio" name="type" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-ink-600">{text}</span>
    </label>
  );

  return (
    <form onSubmit={onSubmit} method="post" encType="multipart/form-data" className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-700">{t("chooseType")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {typeCard("b2c", t("b2cTitle"), t("b2cText"))}
          {typeCard("b2b", t("b2bTitle"), t("b2bText"))}
        </div>
      </fieldset>

      {type === "b2c" ? (
        <Field label={t("yourName")} htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required minLength={2} />
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("companyName")} htmlFor="companyName">
            <Input id="companyName" name="companyName" autoComplete="organization" required minLength={2} />
          </Field>
          <Field label={t("ownerName")} htmlFor="ownerName">
            <Input id="ownerName" name="ownerName" autoComplete="name" required minLength={2} />
          </Field>
          <Field label={t("dealerNumber")} htmlFor="dealerNumber" hint={t("dealerNumberHint")}>
            <Input id="dealerNumber" name="dealerNumber" inputMode="numeric" dir="ltr" className="num text-start" required pattern="[0-9]{6,12}" />
          </Field>
          <Field label={<EmailLabel />} htmlFor="email">
            <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" className="text-start" />
          </Field>
          <Field label={t("license")} htmlFor="license" hint={t("licenseHint", { mb: maxUploadMb })} className="sm:col-span-2">
            <Input id="license" name="license" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("zone")} htmlFor="zoneId">
          <Select id="zoneId" name="zoneId" required defaultValue="">
            <option value="" disabled>
              {t("chooseZone")}
            </option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("city")} htmlFor="city">
          <Input id="city" name="city" required minLength={2} autoComplete="address-level2" />
        </Field>
        <Field label={t("street")} htmlFor="street">
          <Input id="street" name="street" autoComplete="address-line1" />
        </Field>
        <Field label={t("details")} htmlFor="details">
          <Input id="details" name="details" autoComplete="address-line2" />
        </Field>
      </div>

      {type === "b2b" ? <Alert tone="blue">{t("b2bPendingNote")}</Alert> : null}
      {error ? <Alert tone="red">{error}</Alert> : null}

      <Button type="submit" className="w-full sm:w-auto" disabled={!hydrated || pending}>
        {t("submit")}
      </Button>
    </form>
  );
}

function EmailLabel() {
  const t = useTranslations("common");
  return (
    <>
      {t("email")} <span className="text-ink-400">({t("optional")})</span>
    </>
  );
}
