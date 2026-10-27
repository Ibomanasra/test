import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Badge, Button, Card, ErrorText, Field, Loading, Muted, Num, Screen, colors } from "@/components/ui";
import { imageUrl } from "@/lib/api";
import { errorMessage } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { Product } from "@/lib/types";

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { tr, call, locale, me } = useSession();
  const [p, setP] = useState<Product | null>(null);
  const [unit, setUnit] = useState("");
  const [qty, setQty] = useState("1");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    call<Product>(`/api/v1/catalog/${slug}`)
      .then((r) => {
        setP(r);
        const v = r.variants[0];
        if (v) {
          setUnit(v.defaultUnit);
          const f = v.units.find((u) => u.code === v.defaultUnit)?.factor ?? 1;
          setQty(String(Math.max(1, Math.ceil(v.minQtyBase / f))));
        }
      })
      .catch((e: unknown) => setError(errorMessage(locale, e)));
  }, [slug, call, locale]);

  if (!p) return error ? <Screen><ErrorText>{error}</ErrorText></Screen> : <Loading />;
  const v = p.variants[0];

  async function add() {
    if (!me) return router.push("/login");
    setError("");
    try {
      await call("/api/v1/cart/items", { body: { variantId: v!.id, unitCode: unit, qty: Number(qty) } });
      setMsg(tr.t("added"));
    } catch (e) {
      setError(errorMessage(locale, e));
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: tr.pick(p) }} />
      {p.imageIds[0] ? <Image source={{ uri: imageUrl(p.imageIds[0]) }} style={{ width: "100%", aspectRatio: 1, borderRadius: 12 }} resizeMode="contain" /> : null}
      <Text style={{ fontSize: 20, fontWeight: "700", textAlign: "left" }}>{tr.pick(p)}</Text>
      {v ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Num style={{ fontSize: 22, fontWeight: "700", color: colors.brandDark }}>{tr.money(v.unitPrice)}</Num>
            <Badge tone={v.availability === "out" ? "red" : "green"}>{tr.t(v.availability === "out" ? "outOfStock" : "inStock")}</Badge>
          </View>
          <Muted>{p.channel === "B2B" ? tr.t("b2bPrices") : tr.t("b2cPrices")}</Muted>
          {v.tiers?.length ? v.tiers.map((t) => <Num key={t.minQtyBase}>≥ {t.minQtyBase}: {tr.money(t.unitPrice)}</Num>) : null}
          <Muted>{tr.t("unit")}</Muted>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {v.units.map((u) => (
              <Pressable key={u.code} onPress={() => setUnit(u.code)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: unit === u.code ? colors.brand : colors.ink300 }}>
                <Text>{tr.pick(u)}{u.factor > 1 ? ` (${u.factor})` : ""}</Text>
              </Pressable>
            ))}
          </View>
          <Field label={tr.t("qty")} value={qty} onChangeText={setQty} keyboardType="number-pad" />
          <ErrorText>{error}</ErrorText>
          <Button title={msg || tr.t("addToCart")} onPress={() => void add()} disabled={v.availability === "out" || !(Number(qty) > 0)} testID="add-to-cart" />
        </Card>
      ) : null}
      {tr.pick({ ar: p.descriptionAr, en: p.descriptionEn }) ? <Muted>{tr.pick({ ar: p.descriptionAr, en: p.descriptionEn })}</Muted> : null}
    </Screen>
  );
}
