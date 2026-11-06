import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/** Markenzeichen „Glut“ (gleiche Pfade wie im Web: apps/web/src/lib/brand.ts) */
const OUTER = "M33.2 5.5c2.4 9.2 13.8 15.6 13.8 30.1 0 10-6.6 18.4-15 18.4s-15-7.4-15-16.4c0-7.2 3.8-11.9 7.4-16 .2 5.4 2.1 8.6 5.3 9.8-2.3-8.6-.6-17.3 3.5-25.9z";
const INNER = "M32.6 29.8c1.6 5.3 7.4 8.4 7.4 14.6 0 4.8-3.4 8.6-8 8.6s-8-3.6-8-7.9c0-3.7 2.1-5.9 3.8-8 .3 2.5 1.5 4 3.2 4.6-.8-4-.3-8 1.6-11.9z";

export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="o" x1="0.2" y1="1" x2="0.5" y2="0">
          <Stop offset="0" stopColor="#9a3412" />
          <Stop offset="0.5" stopColor="#ea580c" />
          <Stop offset="1" stopColor="#fbbf24" />
        </LinearGradient>
        <LinearGradient id="i" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#fef3c7" />
          <Stop offset="1" stopColor="#fb923c" />
        </LinearGradient>
      </Defs>
      <Rect width="64" height="64" rx="16" fill="#1c1917" />
      <Path d={OUTER} fill="url(#o)" />
      <Path d={INNER} fill="url(#i)" />
    </Svg>
  );
}
