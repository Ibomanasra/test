import { ILS_DENOMINATIONS } from "@sa/core";
import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Button, Card, ErrorText, Muted, Num, Screen, colors, styles } from "@/components/ui";
import { errorMessage } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/** Kassenabschluss: Scheine/Münzen zählen → Soll/Ist/Differenz → einreichen */
export default function CashClosing() {
  const { tr, call, locale } = useSession();
  const [expected, setExpected] = useState(0);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    call<{ cash: { expected: number } }>("/api/v1/driver/tours").then((r) => setExpected(r.cash.expected)).catch(() => undefined);
  }, [call]);

  const total = ILS_DENOMINATIONS.reduce((a, d) => a + d * (Number(counts[d]) || 0), 0);

  async function submit() {
    setError("");
    try {
      const r = await call<{ difference: number }>("/api/v1/driver/cash-closing", { body: { denominations: Object.fromEntries(ILS_DENOMINATIONS.map((d) => [String(d), Number(counts[d]) || 0])) } });
      setDone(r.difference);
    } catch (e) {
      setError(errorMessage(locale, e));
    }
  }

  return (
    <Screen>
      <Card>
        {ILS_DENOMINATIONS.map((d) => (
          <View key={d} style={styles.row}>
            <Num style={{ width: 70 }}>{(d / 100).toFixed(2)}</Num>
            <Text>×</Text>
            <TextInput value={counts[d] ?? ""} onChangeText={(v) => setCounts({ ...counts, [d]: v })} keyboardType="number-pad" style={[styles.input, { flex: 1 }]} accessibilityLabel={(d / 100).toFixed(2)} />
          </View>
        ))}
      </Card>
      <Card>
        <Text style={{ textAlign: "left" }}>{tr.t("counted")}: <Num style={{ fontWeight: "700" }}>{tr.money(total)}</Num></Text>
        <Text style={{ textAlign: "left" }}>{tr.t("openCash")}: <Num>{tr.money(expected)}</Num></Text>
        <Text style={{ textAlign: "left", color: total - expected ? colors.red : colors.green }}>{tr.t("difference")}: <Num>{tr.money(total - expected)}</Num></Text>
      </Card>
      <ErrorText>{error}</ErrorText>
      {done != null ? <Muted>{tr.t("closingDone")}</Muted> : <Button title={tr.t("submitClosing")} onPress={() => void submit()} />}
    </Screen>
  );
}
