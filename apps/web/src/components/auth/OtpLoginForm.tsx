"use client";

import { formatPhone, isValidPhone, normalizePhone } from "@sa/core";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";
import { useHydrated } from "@/lib/use-hydrated";

type VerifyResponse = { status: "logged_in" } | { status: "needs_registration"; registrationToken: string };

export function OtpLoginForm({ next, registerType }: { next?: string; registerType?: "b2c" | "b2b" }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const hydrated = useHydrated();
  const { call, pending, error, setError } = useApi();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function sendCode(value = phone) {
    if (!isValidPhone(value)) return setError(te("invalid_phone"));
    setPhone(value);
    const res = await call("/api/v1/auth/otp/request", { body: { phone: value, purpose: "LOGIN" } });
    if (res) {
      setStep("code");
      setCooldown(60);
    }
  }

  async function verify() {
    const res = await call<VerifyResponse>("/api/v1/auth/otp/verify", { body: { phone, code } });
    if (!res) return;
    if (res.status === "needs_registration") {
      const qs = new URLSearchParams({ t: res.registrationToken });
      if (registerType) qs.set("type", registerType);
      router.push(`/register?${qs.toString()}`);
    } else {
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
      router.refresh();
    }
  }

  return (
    <form
      method="post"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void (step === "phone" ? sendCode(String(new FormData(e.currentTarget).get("phone") ?? "")) : verify());
      }}
    >
      {step === "phone" ? (
        <Field label={tc("phone")} htmlFor="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            className="num text-start"
            placeholder={t("phonePlaceholder")}
            defaultValue={phone}
            required
            autoFocus
          />
        </Field>
      ) : (
        <>
          <p className="text-sm text-ink-600">
            {t.rich("codeSentTo", {
              phone: formatPhone(normalizePhone(phone)),
              num: (chunks) => <span className="num font-medium">{chunks}</span>,
            })}
          </p>
          <Field label={t("codeLabel")} htmlFor="code">
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              className="num text-center text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d٠-٩]/g, ""))}
              required
              autoFocus
            />
          </Field>
        </>
      )}

      {error ? <Alert tone="red">{error}</Alert> : null}

      <Button type="submit" className="w-full" disabled={!hydrated || pending}>
        {step === "phone" ? t("sendCode") : t("verify")}
      </Button>

      {step === "code" ? (
        <div className="flex justify-between text-sm">
          <button type="button" className="text-ink-600 hover:underline" onClick={() => { setStep("phone"); setCode(""); setError(null); }}>
            {t("changePhone")}
          </button>
          <button type="button" className="text-brand-700 hover:underline disabled:text-ink-400" disabled={cooldown > 0 || pending} onClick={() => void sendCode()}>
            {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resend")}
          </button>
        </div>
      ) : null}
    </form>
  );
}
