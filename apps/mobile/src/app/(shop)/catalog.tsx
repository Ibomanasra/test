import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { Badge, ErrorText, Muted, Num, colors, styles } from "@/components/ui";
import { imageUrl } from "@/lib/api";
import { errorMessage } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { Product } from "@/lib/types";

export default function Catalog() {
  const { tr, call, locale, me } = useSession();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (query: string) => {
      setLoading(true);
      setError("");
      try {
        const r = await call<{ items: Product[] }>(`/api/v1/catalog?page=1${query ? `&q=${encodeURIComponent(query)}` : ""}`);
        setItems(r.items);
      } catch (e) {
        setError(errorMessage(locale, e));
      } finally {
        setLoading(false);
      }
    },
    [call, locale],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const b2b = items[0]?.channel === "B2B";
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 12, gap: 6 }}>
        <TextInput value={q} onChangeText={setQ} placeholder={tr.t("search")} style={styles.input} returnKeyType="search" />
        <Muted>{b2b ? tr.t("b2bPrices") : tr.t("b2cPrices")}</Muted>
        {me?.customer?.status === "PENDING_APPROVAL" ? <Muted>{tr.t("pendingApproval")}</Muted> : null}
        <ErrorText>{error}</ErrorText>
      </View>
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(q)} />}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        renderItem={({ item: p }) => {
          const v = p.variants[0];
          return (
            <Pressable onPress={() => router.push(`/product/${p.slug}`)} style={[styles.card, { flexDirection: "row", gap: 12 }]} testID="product-card">
              {p.imageIds[0] ? <Image source={{ uri: imageUrl(p.imageIds[0]) }} style={{ width: 64, height: 64, borderRadius: 8 }} /> : <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: colors.ink100 }} />}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontWeight: "600", textAlign: "left" }}>{tr.pick(p)}</Text>
                {v ? (
                  <View style={styles.row}>
                    <Num style={{ fontWeight: "700", color: colors.brandDark }}>{tr.money(v.unitPrice)}</Num>
                    {v.listUnitPrice ? <Num style={{ textDecorationLine: "line-through", color: colors.ink600 }}>{tr.money(v.listUnitPrice)}</Num> : null}
                    <Badge tone={v.availability === "out" ? "red" : v.availability === "low" ? "amber" : "green"}>{tr.t(v.availability === "out" ? "outOfStock" : v.availability === "low" ? "lowStock" : "inStock")}</Badge>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
