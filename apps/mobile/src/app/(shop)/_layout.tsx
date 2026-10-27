import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { colors } from "@/components/ui";
import { useSession } from "@/lib/session";

const icon = (glyph: string) => function TabIcon({ color }: { color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
};

export default function ShopTabs() {
  const { tr } = useSession();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.brand, headerTintColor: colors.brandDark }}>
      <Tabs.Screen name="catalog" options={{ title: tr.t("catalog"), tabBarIcon: icon("🛒") }} />
      <Tabs.Screen name="cart" options={{ title: tr.t("cart"), tabBarIcon: icon("🧺") }} />
      <Tabs.Screen name="orders" options={{ title: tr.t("orders"), tabBarIcon: icon("📦") }} />
      <Tabs.Screen name="account" options={{ title: tr.t("account"), tabBarIcon: icon("👤") }} />
    </Tabs>
  );
}
