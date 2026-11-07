import { normalizePhone } from "@sa/core";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { Button, Card, ErrorText, Field, Muted, Screen, colors } from "@/components/ui";
import { errorMessage } from "@/lib/i18n";
import { useSession } from "@/lib/session";

interface Zone {
  id: string;
  nameAr: string;
  nameEn: string;
}

/** Registrierung Privatkunde (Händler registrieren sich wegen Lizenz-Upload im Web) */
const normalizeSafe = (p: string) => {
  try {
    return normalizePhone(p);
  } catch {
    return p;
  }
};

export default function Register() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { tr, call, signIn, locale } = useSession();
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call<{ zones: Zone[] }>("/api/v1/delivery-zones").then((r) => setZones(r.zones)).catch(() => undefined);
  }, [call]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await call<{ token: string }>("/api/v1/auth/register/b2c", { body: { ...(token ? { registrationToken: token } : { phone: normalizeSafe(phone), password }), name, locale, address: { zoneId: zoneId || undefined, city, street: street || undefined } } });
      await signIn(r.token);
      router.replace("/");
    } catch (e) {
      setError(errorMessage(locale, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        {!token ? (
          <>
            <Field label={tr.t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="059…" style={{ writingDirection: "ltr" }} />
            <Field label={tr.t("password")} value={password} onChangeText={setPassword} secureTextEntry />
          </>
        ) : null}
        <Field label={tr.t("name")} value={name} onChangeText={setName} />
        <Field label={tr.t("city")} value={city} onChangeText={setCity} />
        <Muted>{tr.t("zone")}</Muted>
        {zones.map((z) => (
          <Pressable key={z.id} onPress={() => setZoneId(zoneId === z.id ? "" : z.id)} style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: zoneId === z.id ? colors.brand : colors.ink300, backgroundColor: zoneId === z.id ? colors.brandSoft : colors.white }}>
            <Text style={{ textAlign: "left" }}>{tr.pick(z)}</Text>
          </Pressable>
        ))}
        <Field label={tr.t("street")} value={street} onChangeText={setStreet} />
        <ErrorText>{error}</ErrorText>
        <Button title={tr.t("createAccount")} onPress={() => void submit()} disabled={busy || name.length < 2 || city.length < 2 || (!token && (phone.length < 9 || password.length < 8))} />
      </Card>
    </Screen>
  );
}
