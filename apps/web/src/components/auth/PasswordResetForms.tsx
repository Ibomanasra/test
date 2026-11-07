"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { useHydrated } from "@/lib/use-hydrated";

/** `customer`: Shop-Kunden (Telefon oder E-Mail); sonst Mitarbeiter (Benutzername, Telefon oder E-Mail) */
export function PasswordResetRequest({ customer = false }: { customer?: boolean }) {
  const t = useTranslations("auth.reset");
  const locale = useLocale();
  const hydrated = useHydrated();
  const { call, pending, error } = useApi();
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const identifier = String(new FormData(e.currentTarget).get("identifier") ?? "");
    if (await call(customer ? "/api/v1/auth/password-reset/request" : "/api/v1/auth/staff/password-reset/request", { body: { identifier }, locale })) setSent(true);
  }
  if (sent) return <Alert tone="green">{customer ? t("sentCustomer") : t("sent")}</Alert>;
  return (
    <form method="post" onSubmit={submit} className="space-y-3">
      <Field label={customer ? t("identifierCustomer") : t("identifier")} htmlFor="identifier"><Input id="identifier" name="identifier" dir="ltr" className="text-start" required autoComplete="username" /></Field>
      <Button type="submit" className="w-full" disabled={pending || !hydrated} data-testid="reset-request">{t("send")}</Button>
      {error ? <Alert tone="red">{error}</Alert> : null}
    </form>
  );
}

export function PasswordResetConfirm({ token, customer = false }: { token: string; customer?: boolean }) {
  const t = useTranslations("auth.reset");
  const locale = useLocale();
  const hydrated = useHydrated();
  const { call, pending, error, setError } = useApi();
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password !== String(fd.get("password2") ?? "")) return setError(t("mismatch"));
    if (await call(customer ? "/api/v1/auth/password-reset/confirm" : "/api/v1/auth/staff/password-reset/confirm", { body: { token, password }, locale })) setDone(true);
  }
  if (done)
    return (
      <Alert tone="green">
        {t("done")} <Link href={customer ? "/login" : "/admin/login"} className="underline">{t("toLogin")}</Link>
      </Alert>
    );
  return (
    <form method="post" onSubmit={submit} className="space-y-3">
      <Field label={t("newPassword")} htmlFor="password" hint={customer ? t("rulesCustomer") : t("rules")}><Input id="password" name="password" type="password" required minLength={customer ? 8 : 10} autoComplete="new-password" /></Field>
      <Field label={t("repeat")} htmlFor="password2"><Input id="password2" name="password2" type="password" required autoComplete="new-password" /></Field>
      <Button type="submit" className="w-full" disabled={pending || !hydrated} data-testid="reset-confirm">{t("save")}</Button>
      {error ? <Alert tone="red">{error}</Alert> : null}
    </form>
  );
}
