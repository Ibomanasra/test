import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Button, Card, ErrorText, Field, Loading, Muted, Num, Screen, colors, styles } from "@/components/ui";
import { openDocument } from "@/lib/documents";
import { errorMessage } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DriverStop, DriverTour } from "@/lib/types";

/** Stopp: Anruf, Karte, Lieferschein; Zustellung mit Empfänger und Bargeld oder Nicht-Zustellung mit Grund */
export default function StopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tr, call, locale, token } = useSession();
  const [stop, setStop] = useState<DriverStop | null>(null);
  const [name, setName] = useState("");
  const [cash, setCash] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"deliver" | "fail">("deliver");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    call<{ tours: DriverTour[] }>("/api/v1/driver/tours")
      .then((r) => {
        const s = r.tours.flatMap((t) => t.stops).find((x) => x.id === id) ?? null;
        setStop(s);
        if (s?.codExpected) setCash((s.codExpected / 100).toFixed(2));
      })
      .catch((e: unknown) => setError(errorMessage(locale, e)));
  }, [call, id, locale]);

  if (!stop) return error ? <Screen><ErrorText>{error}</ErrorText></Screen> : <Loading />;
  const a = stop.shipment.order.addressSnapshot ?? {};
  const phone = a.phone ?? stop.shipment.order.customer.phone ?? "";

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (mode === "deliver") {
        const cashAmount = cash.trim() ? Math.round(Number(cash.replace(",", ".")) * 100) : 0;
        if (!Number.isFinite(cashAmount) || cashAmount < 0) throw { body: { code: "invalid_amount" } };
        await call(`/api/v1/driver/stops/${stop!.id}/deliver`, { body: { receivedByName: name || undefined, cashAmount } });
      } else {
        await call(`/api/v1/driver/stops/${stop!.id}/fail`, { body: { reason } });
      }
      router.back();
    } catch (e) {
      setError(errorMessage(locale, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `${stop.sequence}. ${stop.shipment.order.customer.displayName}` }} />
      <Card>
        <Text style={{ fontWeight: "700", textAlign: "left" }}>{stop.shipment.order.customer.displayName}</Text>
        <Muted>{[a.recipient, a.city, a.street, a.details].filter(Boolean).join("، ")}</Muted>
        <Num style={{ color: colors.ink600 }}>{stop.shipment.number} · {stop.shipment.order.number}</Num>
        <View style={styles.row}>
          {phone ? <Button title={`📞 ${tr.t("call")}`} variant="secondary" onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
          {a.city ? <Button title={`🗺 ${tr.t("map")}`} variant="secondary" onPress={() => void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent([a.street, a.city].filter(Boolean).join(", "))}`)} /> : null}
          <Button title="🖨 PDF" variant="secondary" onPress={() => void openDocument(`/api/v1/documents/delivery-note/${stop.shipmentId}`, token, `${stop.shipment.number}.pdf`, locale).catch((e: unknown) => setError(errorMessage(locale, e)))} />
        </View>
        {stop.codExpected > 0 ? <Text style={{ color: colors.brandDark, fontWeight: "700", textAlign: "left" }}>{tr.t("collect")}: <Num>{tr.money(stop.codExpected)}</Num></Text> : null}
      </Card>
      {stop.status === "PENDING" ? (
        <Card>
          <View style={styles.row}>
            <Button title={tr.t("delivered")} variant={mode === "deliver" ? "primary" : "secondary"} onPress={() => setMode("deliver")} />
            <Button title={tr.t("notDelivered")} variant={mode === "fail" ? "danger" : "secondary"} onPress={() => setMode("fail")} />
          </View>
          {mode === "deliver" ? (
            <>
              <Field label={tr.t("receivedBy")} value={name} onChangeText={setName} />
              {stop.codExpected > 0 ? <Field label={tr.t("cash")} value={cash} onChangeText={setCash} keyboardType="decimal-pad" /> : null}
            </>
          ) : (
            <Field label={tr.t("reason")} value={reason} onChangeText={setReason} />
          )}
          <ErrorText>{error}</ErrorText>
          <Button title={tr.t("confirm")} onPress={() => void submit()} disabled={busy || (mode === "fail" && reason.trim().length < 3)} />
        </Card>
      ) : (
        <Muted>{stop.status === "DELIVERED" ? tr.t("delivered") : `${tr.t("notDelivered")}: ${stop.failReason ?? ""}`}</Muted>
      )}
    </Screen>
  );
}
