import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Badge, Button, Card, Muted, Num, colors, styles } from "@/components/ui";
import { useSession } from "@/lib/session";
import type { DriverTour } from "@/lib/types";

/** Fahrer: heutige Touren mit Stopps; Tippen öffnet den Stopp */
export default function DriverHome() {
  const { tr, call, signOut } = useSession();
  const [tours, setTours] = useState<DriverTour[]>([]);
  const [cash, setCash] = useState(0);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    call<{ tours: DriverTour[]; cash: { expected: number } }>("/api/v1/driver/tours")
      .then((r) => {
        setTours(r.tours);
        setCash(r.cash.expected);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [call]);
  useFocusEffect(load);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 12, gap: 10 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Stack.Screen options={{ headerRight: () => <Text onPress={() => void signOut().then(() => router.replace("/login"))} style={{ color: colors.brand }}>{tr.t("logout")}</Text> }} />
      <Card>
        <View style={styles.row}>
          <Text style={{ flex: 1, textAlign: "left" }}>{tr.t("openCash")}</Text>
          <Num style={{ fontWeight: "700" }}>{tr.money(cash)}</Num>
        </View>
        <Button title={tr.t("cashClosing")} variant="secondary" onPress={() => router.push("/driver/cash")} />
      </Card>
      {tours.length === 0 ? <Muted>{tr.t("noTours")}</Muted> : null}
      {tours.map((t) => (
        <View key={t.id} style={{ gap: 8 }}>
          <Num style={{ fontWeight: "700" }}>{t.number} · {t.date.slice(0, 10)}</Num>
          {t.stops.map((s) => {
            const a = s.shipment.order.addressSnapshot ?? {};
            return (
              <Pressable key={s.id} style={styles.card} onPress={() => router.push({ pathname: "/driver/stop/[id]", params: { id: s.id, tour: t.id } })}>
                <View style={styles.row}>
                  <Text style={{ fontWeight: "600", flex: 1, textAlign: "left" }}><Num>{s.sequence}.</Num> {s.shipment.order.customer.displayName}</Text>
                  <Badge tone={s.status === "DELIVERED" ? "green" : s.status === "FAILED" ? "red" : "neutral"}>{s.status === "DELIVERED" ? tr.t("delivered") : s.status === "FAILED" ? tr.t("notDelivered") : "…"}</Badge>
                </View>
                <Muted>{[a.city, a.street, a.details].filter(Boolean).join("، ")}</Muted>
                {s.codExpected > 0 && s.status === "PENDING" ? <Text style={{ color: colors.brandDark, fontWeight: "700", textAlign: "left" }}>{tr.t("collect")}: <Num>{tr.money(s.codExpected)}</Num></Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
