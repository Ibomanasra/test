import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { Button, Card, ErrorText, Loading, Muted, Num, Screen, colors } from "@/components/ui";
import { errorMessage } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { CheckoutOptions } from "@/lib/types";

function Choice({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? colors.brand : colors.ink300, backgroundColor: selected ? colors.brandSoft : colors.white }}>
      {children}
    </Pressable>
  );
}

export default function Checkout() {
  const { tr, call, locale } = useSession();
  const [opts, setOpts] = useState<CheckoutOptions | null>(null);
  const [addressId, setAddressId] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("");
  const [preview, setPreview] = useState<{ gross: number; belowMinimum: boolean; minimumOrder: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    call<CheckoutOptions>("/api/v1/checkout")
      .then((o) => {
        setOpts(o);
        const a = o.addresses[0];
        if (a) {
          setAddressId(a.id);
          setDate(a.deliveryDates[0] ?? "");
        }
        setMethod(o.paymentMethods[0]?.method ?? "");
      })
      .catch((e: unknown) => setError(errorMessage(locale, e)));
  }, [call, locale]);

  useEffect(() => {
    if (addressId) call<{ gross: number; belowMinimum: boolean; minimumOrder: number }>("/api/v1/checkout/preview", { body: { addressId } }).then(setPreview).catch(() => undefined);
  }, [addressId, call]);

  async function place() {
    setBusy(true);
    setError("");
    try {
      const order = await call<{ id: string }>("/api/v1/orders", { body: { addressId, paymentMethod: method, requestedDeliveryDate: date } });
      if (method === "CARD_GATEWAY") {
        // gehostete Bezahlseite im System-Browser, danach Status beim Server abfragen
        const pay = await call<{ intentId: string; redirectUrl: string }>(`/api/v1/orders/${order.id}/pay`, { body: {} });
        await WebBrowser.openAuthSessionAsync(pay.redirectUrl);
        await call(`/api/v1/payments/intents/${pay.intentId}`).catch(() => undefined);
      }
      router.replace(`/order/${order.id}`);
    } catch (e) {
      setError(errorMessage(locale, e));
    } finally {
      setBusy(false);
    }
  }

  if (!opts) return error ? <Screen><ErrorText>{error}</ErrorText></Screen> : <Loading />;
  const address = opts.addresses.find((a) => a.id === addressId);
  return (
    <Screen>
      <Card>
        <Muted>{tr.t("address")}</Muted>
        {opts.addresses.map((a) => (
          <Choice key={a.id} selected={a.id === addressId} onPress={() => { setAddressId(a.id); setDate(a.deliveryDates[0] ?? ""); }}>
            <Text style={{ textAlign: "left" }}>{a.recipient} – {tr.pick(a.zone)}, {a.city}</Text>
          </Choice>
        ))}
      </Card>
      <Card>
        <Muted>{tr.t("deliveryDay")}</Muted>
        {(address?.deliveryDates ?? []).slice(0, 5).map((d) => (
          <Choice key={d} selected={d === date} onPress={() => setDate(d)}>
            <Num>{d}</Num>
          </Choice>
        ))}
      </Card>
      <Card>
        <Muted>{tr.t("payment")}</Muted>
        {opts.paymentMethods.map((m) => (
          <Choice key={m.method} selected={m.method === method} onPress={() => setMethod(m.method)}>
            <Text style={{ textAlign: "left" }}>{locale === "ar" ? m.labelAr : m.labelEn}</Text>
          </Choice>
        ))}
      </Card>
      {preview ? (
        <Card>
          <Text style={{ fontWeight: "700", textAlign: "left" }}>{tr.t("total")}: <Num>{tr.money(preview.gross)}</Num></Text>
          {preview.belowMinimum ? <ErrorText>{errorMessage(locale, { body: { code: "below_minimum_order" } })}: {tr.money(preview.minimumOrder)}</ErrorText> : null}
        </Card>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button title={tr.t("placeOrder")} onPress={() => void place()} disabled={busy || !addressId || !date || !method || !!preview?.belowMinimum} testID="place-order" />
    </Screen>
  );
}
