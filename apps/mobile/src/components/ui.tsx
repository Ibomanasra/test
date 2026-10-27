import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Farben wie im Web (Markenfarbe Orange/Braun, Tinte Grau) */
export const colors = {
  brand: "#c2410c",
  brandDark: "#7c2d12",
  brandSoft: "#fff7ed",
  ink: "#111827",
  ink600: "#4b5563",
  ink300: "#d1d5db",
  ink100: "#f3f4f6",
  bg: "#f9fafb",
  green: "#15803d",
  red: "#b91c1c",
  amber: "#b45309",
  white: "#ffffff",
};

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const inner = <View style={[padded && styles.padded, styles.gap]}>{children}</View>;
  return <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>{scroll ? <ScrollView keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}</SafeAreaView>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Num({ children, style }: { children: ReactNode; style?: object }) {
  // Zahlen immer LTR (auch in arabischem Text)
  return <Text style={[styles.num, style]}>{children}</Text>;
}

export function Button({ title, onPress, variant = "primary", disabled, testID }: { title: string; onPress: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, variant === "secondary" ? styles.btnSecondary : variant === "danger" ? styles.btnDanger : styles.btnPrimary, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={[styles.btnText, variant === "secondary" && { color: colors.ink }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.ink600} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

export function Loading() {
  return (
    <View style={{ padding: 32, alignItems: "center" }}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "red" | "amber" }) {
  const c = tone === "green" ? colors.green : tone === "red" ? colors.red : tone === "amber" ? colors.amber : colors.ink600;
  return <Text style={[styles.badge, { color: c, borderColor: c }]}>{children}</Text>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: 16 },
  gap: { gap: 12 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 14, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.ink300 },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, textAlign: "left" },
  muted: { fontSize: 13, color: colors.ink600, textAlign: "left" },
  num: { writingDirection: "ltr", fontVariant: ["tabular-nums"] },
  label: { fontSize: 13, color: colors.ink600, textAlign: "left" },
  input: { borderWidth: 1, borderColor: colors.ink300, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: colors.white, color: colors.ink, textAlign: "left" },
  btn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.brand },
  btnSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.ink300 },
  btnDanger: { backgroundColor: colors.red },
  btnText: { color: colors.white, fontWeight: "600", fontSize: 16 },
  error: { color: colors.red, fontSize: 14, textAlign: "left" },
  badge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
