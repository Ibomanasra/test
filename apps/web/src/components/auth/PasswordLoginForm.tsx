"use client";

import { isValidPhone } from "@sa/core";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Input } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { useHydrated } from "@/lib/use-hydrated";

/** Kunden-Login: Telefon + Passwort (kostenlos, ohne SMS) */
export function PasswordLoginForm({ next, registerType }: { next?: string; registerType?: "b2c" | "b2b" }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const hydrated = useHydrated();
  const { call, pending, error, setError } = useApi();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = String(fd.get("phone") ?? "");
    if (!isValidPhone(phone)) return setError(te("invalid_phone"));
    const res = await call("/api/v1/auth/login", { body: { phone, password: String(fd.get("password") ?? "") } });
    if (res) {
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
      router.refresh();
    }
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-4" data-testid="password-login">
      <Field label={tc("phone")} htmlFor="phone">
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" className="num text-start" placeholder={t("phonePlaceholder")} required autoFocus />
      </Field>
      <Field label={t("password")} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error ? <Alert tone="red">{error}</Alert> : null}
      <Button type="submit" className="w-full" disabled={!hydrated || pending}>{t("loginButton")}</Button>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-ink-600 hover:underline">{t("forgot")}</Link>
        <Link href={`/register?${new URLSearchParams({ ...(registerType ? { type: registerType } : {}), ...(next ? { next } : {}) }).toString()}`} className="font-semibold text-brand-700 hover:underline" data-testid="to-register">{t("createAccount")}</Link>
      </div>
    </form>
  );
}
