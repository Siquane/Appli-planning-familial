import { useId } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { color, gradient } from "../theme/tokens";

// The logo's neon gradient (cyan → blue → violet), stretched behind its parent.
// Drawn with react-native-svg so no extra native module is needed.
export function GradientFill({ radius = 0, style }: { radius?: number; style?: ViewStyle }) {
  const id = `g${useId().replace(/:/g, "")}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            {gradient.map((c, i) => (
              <Stop key={c} offset={i / (gradient.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

// The Passerelle mark: a footbridge arch resting on 4 rings, one per tab colour.
export function PasserelleArch({ width = 44 }: { width?: number }) {
  const id = `a${useId().replace(/:/g, "")}`;
  // Arche haute : les traits verticaux descendent loin sous les anneaux.
  const base = 74;
  const rings = [
    { cx: 15, cy: 32, c: color.pillar1 },
    { cx: 52, cy: 11, c: color.pillar2 },
    { cx: 88, cy: 11, c: color.pillar3 },
    { cx: 125, cy: 32, c: color.pillar4 },
  ];
  return (
    <Svg width={width} height={(width * 80) / 140} viewBox="0 0 140 80" accessibilityLabel="Passerelle">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {gradient.map((c, i) => (
            <Stop key={c} offset={i / (gradient.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Path
        d="M15 32 C29 20 39 14 52 11 C64 9 76 9 88 11 C101 14 111 20 125 32"
        stroke={`url(#${id})`}
        strokeWidth={6}
        fill="none"
        strokeLinecap="round"
      />
      <Line x1={4} y1={base} x2={136} y2={base} stroke={`url(#${id})`} strokeWidth={6} strokeLinecap="round" />
      {rings.map((r) => (
        <Line key={`l${r.cx}`} x1={r.cx} y1={r.cy} x2={r.cx} y2={base} stroke={r.c} strokeWidth={4} />
      ))}
      {rings.map((r) => (
        <Circle key={`c${r.cx}`} cx={r.cx} cy={r.cy} r={8} fill={color.bg} stroke={r.c} strokeWidth={6} />
      ))}
    </Svg>
  );
}
