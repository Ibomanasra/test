import { normalizePhone } from "@sa/core";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { Button, Card, ErrorText, Field, H1, Muted, Screen, colors } from "@/components/ui";
import { errorMessage } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/** Kunden: Telefon + SMS-Code · Mitarbeiter/Fahrer: Telefon + Passwort + SMS-Code */
export default function Login() {
  const { tr, call, signIn, locale } = useSession();
  const [staff, setStaff] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(locale, e));
    } finally {
      setBusy(false);
    }
  }

  const e164 = () => {
    try {
      return normalizePhone(phone);
    } catch {
      return phone;
    }
  };

  const start = () =>
    run(async () => {
      if (staff) {
        const r = await call<{ ticket: string }>("/api/v1/auth/staff/login", { body: { phone: e164(), password } });
        setTicket(r.ticket);
      } else {
        await call("/api/v1/auth/otp/request", { body: { phone: e164(), purpose: "LOGIN" } });
      }
      setSent(true);
    });

  const verify = () =>
    run(async () => {
      if (staff) {
        const r = await call<{ token: string }>("/api/v1/auth/staff/verify", { body: { ticket, code, client: "MOBILE" } });
        await signIn(r.token);
        router.replace("/");
        return;
      }
      const r = await call<{ status: string; token?: string; registrationToken?: string }>("/api/v1/auth/otp/verify", { body: { phone: e164(), code, client: "MOBILE" } });
      if (r.status === "needs_registration" && r.registrationToken) router.replace({ pathname: "/register", params: { token: r.registrationToken } });
      else if (r.token) {
        await signIn(r.token);
        router.replace("/");
      }
    });

  return (
    <Screen>
      <H1>{tr.t("appName")}</H1>
      <Card>
        <Muted>{staff ? tr.t("staffLogin") : tr.t("customerLogin")}</Muted>
        <Field label={tr.t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="059…" editable={!sent} style={{ writingDirection: "ltr" }} />
        {staff ? <Field label={tr.t("password")} value={password} onChangeText={setPassword} secureTextEntry editable={!sent} /> : null}
        {sent ? <Field label={tr.t("code")} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="sms-otp" textContentType="oneTimeCode" /> : null}
        <ErrorText>{error}</ErrorText>
        {sent ? <Button title={tr.t("verify")} onPress={() => void verify()} disabled={busy || code.length !== 6} /> : <Button title={staff ? tr.t("continue") : tr.t("sendCode")} onPress={() => void start()} disabled={busy || phone.length < 9} />}
      </Card>
      <Pressable onPress={() => { setStaff(!staff); setSent(false); setCode(""); setError(""); }}>
        <Text style={{ color: colors.brand, textAlign: "center" }}>{staff ? tr.t("customerLogin") : tr.t("staffLogin")}</Text>
      </Pressable>
    </Screen>
  );
}
