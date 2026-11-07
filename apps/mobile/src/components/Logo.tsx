import { Image } from "react-native";

/** Firmenlogo „شعلة الجنوب“ (Haus mit Kalligrafie), Seitenverhältnis 906 × 604 */
export function Logo({ height = 96 }: { height?: number }) {
  return <Image source={require("../../assets/logo.png")} style={{ height, width: Math.round((height * 906) / 604) }} resizeMode="contain" accessibilityLabel="شعلة الجنوب" />;
}
