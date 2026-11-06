"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { useHydrated } from "@/lib/use-hydrated";

export function PasswordResetRequest() {
  const t = useTranslations("auth.reset");
  const locale = useLocale();
  const hydrated = useHydrated();
  const { call, pending, error } = useApi();
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const identifier = String(new FormData(e.currentTarget).get("identifier") ?? "");
    if (await call("/api/v1/auth/staff/password-reset/request", { body: { identifier }, locale })) setSent(true);
  }
  if (sent) return <Alert tone="green">{t("sent")}</Alert>;
  return (
    <form method="post" onSubmit={submit} className="space-y-3">
      <Field label={t("identifier")} htmlFor="identifier"><Input id="identifier" name="identifier" dir="ltr" required autoComplete="username" /></Field>
      <Button type="submit" className="w-full" disabled={pending || !hydrated} data-testid="reset-request">{t("send")}</Button>
      {error ? <Alert tone="red">{error}</Alert> : null}
    </form>
  );
}

export function PasswordResetConfirm({ token }: { token: string }) {
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
    if (await call("/api/v1/auth/staff/password-reset/confirm", { body: { token, password }, locale })) setDone(true);
  }
  if (done)
    return (
      <Alert tone="green">
        {t("done")} <Link href="/admin/login" className="underline">{t("toLogin")}</Link>
      </Alert>
    );
  return (
    <form method="post" onSubmit={submit} className="space-y-3">
      <Field label={t("newPassword")} htmlFor="password" hint={t("rules")}><Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" /></Field>
      <Field label={t("repeat")} htmlFor="password2"><Input id="password2" name="password2" type="password" required autoComplete="new-password" /></Field>
      <Button type="submit" className="w-full" disabled={pending || !hydrated} data-testid="reset-confirm">{t("save")}</Button>
      {error ? <Alert tone="red">{error}</Alert> : null}
    </form>
  );
}
