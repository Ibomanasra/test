import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "./ui";

/**
 * Unterschrift mit dem Finger. Liefert Pfade in einem festen Koordinatenraum (1000 × 400),
 * damit der Server daraus ein sauberes SVG bauen kann.
 */
export function SignaturePad({ onChange, clearLabel }: { onChange: (paths: string[]) => void; clearLabel: string }) {
  const [paths, setPaths] = useState<string[]>([]);
  const size = useRef({ w: 1, h: 1 });
  const current = useRef("");

  const pt = (x: number, y: number) => `${Math.round((x / size.current.w) * 1000)} ${Math.round((y / size.current.h) * 400)}`;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          current.current = `M${pt(e.nativeEvent.locationX, e.nativeEvent.locationY)}`;
          setPaths((p) => [...p, current.current]);
        },
        onPanResponderMove: (e) => {
          current.current += ` L${pt(e.nativeEvent.locationX, e.nativeEvent.locationY)}`;
          setPaths((p) => [...p.slice(0, -1), current.current]);
        },
        onPanResponderRelease: () => {
          setPaths((p) => {
            onChange(p);
            return p;
          });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange],
  );

  return (
    <View>
      <View
        {...responder.panHandlers}
        onLayout={(e: LayoutChangeEvent) => (size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ height: 160, borderWidth: 1, borderColor: colors.ink300, borderRadius: 10, backgroundColor: colors.white }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 1000 400">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke={colors.ink} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
      </View>
      <Pressable onPress={() => { setPaths([]); onChange([]); }}>
        <Text style={{ color: colors.ink600, textDecorationLine: "underline", marginTop: 4, textAlign: "left" }}>{clearLabel}</Text>
      </Pressable>
    </View>
  );
}
