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
export default function Register() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { tr, call, signIn, locale } = useSession();
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [name, setName] = useState("");
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
      const r = await call<{ token: string }>("/api/v1/auth/register/b2c", { body: { registrationToken: token, name, locale, address: { zoneId, city, street: street || undefined } } });
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
        <Field label={tr.t("name")} value={name} onChangeText={setName} />
        <Muted>{tr.t("zone")}</Muted>
        {zones.map((z) => (
          <Pressable key={z.id} onPress={() => setZoneId(z.id)} style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: zoneId === z.id ? colors.brand : colors.ink300, backgroundColor: zoneId === z.id ? colors.brandSoft : colors.white }}>
            <Text style={{ textAlign: "left" }}>{tr.pick(z)}</Text>
          </Pressable>
        ))}
        <Field label={tr.t("city")} value={city} onChangeText={setCity} />
        <Field label={tr.t("street")} value={street} onChangeText={setStreet} />
        <ErrorText>{error}</ErrorText>
        <Button title={tr.t("createAccount")} onPress={() => void submit()} disabled={busy || name.length < 2 || !zoneId || city.length < 2} />
      </Card>
    </Screen>
  );
}
