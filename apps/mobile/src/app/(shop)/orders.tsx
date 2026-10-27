import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Badge, Button, Muted, Num, colors, styles } from "@/components/ui";
import { useSession } from "@/lib/session";
import type { OrderSummary } from "@/lib/types";

export default function Orders() {
  const { tr, call, me } = useSession();
  const [items, setItems] = useState<OrderSummary[]>([]);
  const load = useCallback(() => {
    if (me?.customer) call<{ items: OrderSummary[] }>("/api/v1/orders").then((r) => setItems(r.items)).catch(() => undefined);
  }, [call, me]);
  useFocusEffect(load);
  if (!me) return <View style={{ padding: 16 }}><Button title={tr.t("login")} onPress={() => router.push("/login")} /></View>;
  return (
    <FlatList
      data={items}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      ListEmptyComponent={<Muted>{tr.t("noOrders")}</Muted>}
      keyExtractor={(o) => o.id}
      renderItem={({ item: o }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/order/${o.id}`)}>
          <View style={styles.row}>
            <Num style={{ fontWeight: "700", flex: 1 }}>{o.number}</Num>
            <Badge tone={o.status === "DELIVERED" ? "green" : o.status === "CANCELLED" ? "red" : "neutral"}>{tr.status(o.status)}</Badge>
          </View>
          <View style={styles.row}>
            <Num style={{ color: colors.ink600, flex: 1 }}>{o.placedAt.slice(0, 10)}</Num>
            <Num style={{ fontWeight: "600" }}>{tr.money(o.totalGross)}</Num>
          </View>
        </Pressable>
      )}
    />
  );
}
