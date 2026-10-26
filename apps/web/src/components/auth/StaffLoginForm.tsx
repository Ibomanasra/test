"use client";

import { isValidPhone } from "@sa/core";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Unkontrollierte Felder (Werte per FormData): Eingaben vor der Hydration gehen nicht verloren.
 * Absenden erst nach Hydration möglich – sonst würde der Browser das Formular nativ abschicken.
 */
export function StaffLoginForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const hydrated = useHydrated();
  const { call, pending, error, setError } = useApi();
  const [ticket, setTicket] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!ticket) {
      const phone = String(fd.get("phone") ?? "");
      if (!isValidPhone(phone)) return setError(te("invalid_phone"));
      const res = await call<{ ticket: string }>("/api/v1/auth/staff/login", { body: { phone, password: String(fd.get("password") ?? "") } });
      if (res) setTicket(res.ticket);
      return;
    }
    const res = await call("/api/v1/auth/staff/verify", { body: { ticket, code: String(fd.get("code") ?? "") } });
    if (res) {
      router.replace("/admin");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} method="post" className="space-y-4">
      {!ticket ? (
        <>
          <Field label={tc("phone")} htmlFor="phone">
            <Input id="phone" name="phone" type="tel" dir="ltr" className="num text-start" autoComplete="username" required autoFocus />
          </Field>
          <Field label={t("password")} htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
        </>
      ) : (
        <Field label={t("codeLabel")} htmlFor="code">
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            className="num text-center text-2xl tracking-[0.5em]"
            required
            autoFocus
          />
        </Field>
      )}
      {error ? <Alert tone="red">{error}</Alert> : null}
      <Button type="submit" className="w-full" disabled={!hydrated || pending}>
        {ticket ? t("verify") : t("continue")}
      </Button>
    </form>
  );
}
