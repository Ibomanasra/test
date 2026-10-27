import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/components/ui";
import { SessionProvider, useSession } from "@/lib/session";

function Nav() {
  const { tr } = useSession();
  return (
    <Stack screenOptions={{ headerTintColor: colors.brandDark, headerTitleStyle: { fontWeight: "700" }, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(shop)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: tr.t("login") }} />
      <Stack.Screen name="register" options={{ title: tr.t("register") }} />
      <Stack.Screen name="product/[slug]" options={{ title: "" }} />
      <Stack.Screen name="checkout" options={{ title: tr.t("checkout") }} />
      <Stack.Screen name="order/[id]" options={{ title: "" }} />
      <Stack.Screen name="driver/index" options={{ title: tr.t("driver") }} />
      <Stack.Screen name="driver/stop/[id]" options={{ title: "" }} />
      <Stack.Screen name="driver/cash" options={{ title: tr.t("cashClosing") }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Nav />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
