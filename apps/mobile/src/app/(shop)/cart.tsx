import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, ErrorText, Loading, Muted, Num, Screen, colors, styles } from "@/components/ui";
import { errorMessage } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { Cart } from "@/lib/types";

export default function CartScreen() {
  const { tr, call, locale, me } = useSession();
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    call<Cart>("/api/v1/cart").then(setCart).catch((e: unknown) => setError(errorMessage(locale, e)));
  }, [call, locale]);
  useFocusEffect(load);

  async function setQty(id: string, qty: number) {
    try {
      await call(`/api/v1/cart/items/${id}`, { method: "PATCH", body: { qty } });
      load();
    } catch (e) {
      setError(errorMessage(locale, e));
    }
  }

  if (!me) return <Screen><Button title={tr.t("login")} onPress={() => router.push("/login")} /></Screen>;
  if (!cart) return <Loading />;
  if (cart.lines.length === 0) return <Screen><Muted>{tr.t("emptyCart")}</Muted></Screen>;
  return (
    <Screen>
      {cart.lines.map((l) => (
        <Card key={l.id}>
          <Text style={{ fontWeight: "600", textAlign: "left" }}>{tr.pick(l)}</Text>
          <Num style={{ color: colors.ink600 }}>{l.sku}</Num>
          <View style={styles.row}>
            <Button title="−" variant="secondary" onPress={() => void setQty(l.id, l.qty - 1)} />
            <Num style={{ fontSize: 18, minWidth: 36, textAlign: "center" }}>{l.qty}</Num>
            <Button title="+" variant="secondary" onPress={() => void setQty(l.id, l.qty + 1)} />
            <Text>{locale === "ar" ? l.unitNameAr : l.unitNameEn}</Text>
            <View style={{ flex: 1 }} />
            <Num style={{ fontWeight: "700" }}>{tr.money(l.lineTotal)}</Num>
          </View>
          {l.problem ? <ErrorText>{l.problem}</ErrorText> : null}
        </Card>
      ))}
      <Card>
        <View style={styles.row}>
          <Text style={{ fontWeight: "700", flex: 1, textAlign: "left" }}>{tr.t("total")}</Text>
          <Num style={{ fontSize: 18, fontWeight: "700" }}>{tr.money(cart.gross)}</Num>
        </View>
        <Muted>{cart.channel === "B2B" ? tr.t("b2bPrices") : tr.t("b2cPrices")}</Muted>
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button title={tr.t("checkout")} onPress={() => router.push("/checkout")} disabled={cart.hasProblems} testID="to-checkout" />
    </Screen>
  );
}
