import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Badge, Button, Card, ErrorText, Loading, Muted, Num, Screen, styles } from "@/components/ui";
import { openDocument } from "@/lib/documents";
import { errorMessage } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { OrderDetail } from "@/lib/types";

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tr, call, locale, token } = useSession();
  const [o, setO] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    call<OrderDetail>(`/api/v1/orders/${id}`).then(setO).catch((e: unknown) => setError(errorMessage(locale, e)));
  }, [call, id, locale]);
  useEffect(load, [load]);

  async function doc(path: string, name: string) {
    try {
      await openDocument(path, token, `${name}.pdf`, locale);
    } catch (e) {
      setError(errorMessage(locale, e));
    }
  }

  async function pay() {
    try {
      const p = await call<{ intentId: string; redirectUrl: string }>(`/api/v1/orders/${id}/pay`, { body: {} });
      await WebBrowser.openAuthSessionAsync(p.redirectUrl);
      await call(`/api/v1/payments/intents/${p.intentId}`).catch(() => undefined);
      load();
    } catch (e) {
      setError(errorMessage(locale, e));
    }
  }

  if (!o) return error ? <Screen><ErrorText>{error}</ErrorText></Screen> : <Loading />;
  return (
    <Screen>
      <Stack.Screen options={{ title: o.number }} />
      <Card>
        <View style={styles.row}>
          <Num style={{ fontWeight: "700", flex: 1 }}>{o.number}</Num>
          <Badge tone={o.status === "DELIVERED" ? "green" : o.status === "CANCELLED" ? "red" : "neutral"}>{tr.status(o.status)}</Badge>
        </View>
        <Muted>{o.paymentStatus === "PAID" ? tr.t("paid") : ""}</Muted>
      </Card>
      <Card>
        {o.items.map((i) => (
          <View key={i.id} style={styles.row}>
            <Text style={{ flex: 1, textAlign: "left" }}>{locale === "ar" ? i.nameArSnapshot : i.nameEnSnapshot} × <Num>{i.qty}</Num></Text>
            <Num>{tr.money(o.channel === "B2B" ? i.lineNet : i.lineGross)}</Num>
          </View>
        ))}
        <View style={styles.row}>
          <Text style={{ flex: 1, fontWeight: "700", textAlign: "left" }}>{tr.t("total")}</Text>
          <Num style={{ fontWeight: "700" }}>{tr.money(o.totalGross)}</Num>
        </View>
      </Card>
      {o.paymentMethod === "CARD_GATEWAY" && o.paymentStatus !== "PAID" && o.status === "NEW" ? <Button title={tr.t("payNow")} onPress={() => void pay()} /> : null}
      <Card>
        <Muted>{tr.t("documents")}</Muted>
        <Button title={`${tr.t("openPdf")} – ${o.number}`} variant="secondary" onPress={() => void doc(`/api/v1/documents/order-confirmation/${o.id}`, o.number)} />
        {o.invoices.map((inv) => <Button key={inv.id} title={`${tr.t("openPdf")} – ${inv.number}`} variant="secondary" onPress={() => void doc(`/api/v1/documents/invoice/${inv.id}`, inv.number)} />)}
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button title={tr.t("reorder")} variant="secondary" onPress={() => void call("/api/v1/cart/reorder", { body: { orderId: o.id } }).catch(() => undefined)} />
    </Screen>
  );
}
