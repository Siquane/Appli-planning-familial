import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { PasserelleArch } from "./Brand";
import { color, glow, gradient, space } from "../theme/tokens";

// Touches ludiques, inspirées de Cervelle mais en léger : une case ronde qui
// rebondit, l'anneau du jour et les écrans vides avec l'arche qui flotte.
// Tout passe par l'API Animated de React Native (aucun module natif en plus)
// et se coupe quand le téléphone demande de réduire les animations.

function useReduceMotion() {
  const reduce = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => (reduce.current = v))
      .catch(() => {});
  }, []);
  return reduce;
}

const SPARKS = [
  { dx: -17, dy: -15 },
  { dx: 17, dy: -15 },
  { dx: 0, dy: -21 },
  { dx: -19, dy: 8 },
  { dx: 19, dy: 8 },
];

/** Case ronde « fait », à la couleur de la catégorie : rebond et étincelles quand on coche. */
export function DoneCheck({ done, tint, label, onToggle }: { done: boolean; tint: string; label: string; onToggle: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!done || reduce.current) return;
    scale.setValue(0.6);
    burst.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 3.5, tension: 220, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [done]);

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={done ? `${label} : faite. Toucher pour décocher.` : `Marquer « ${label} » comme faite`}
      hitSlop={10}
      style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}
    >
      {SPARKS.map((s, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: tint,
            opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, s.dx] }) },
              { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, s.dy] }) },
            ],
          }}
        />
      ))}
      <Animated.View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2.5,
          borderColor: tint,
          backgroundColor: done ? tint : "transparent",
          boxShadow: done ? glow(tint, 10) : undefined,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale }],
        }}
      >
        {done && (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M5 12.5l4.5 4.5L19 7" stroke={color.onGradient} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </Animated.View>
    </Pressable>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** L'anneau du jour, comme ceux du logo : il se remplit en dégradé au fil des tâches faites. */
export function DayRing({ done, total, title, detail }: { done: number; total: number; title: string; detail: string }) {
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = total ? done / total : 0;
  const progress = useRef(new Animated.Value(ratio)).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (reduce.current) progress.setValue(ratio);
    else Animated.timing(progress, { toValue: ratio, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [ratio]);

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${done} tâche${done > 1 ? "s" : ""} faite${done > 1 ? "s" : ""} sur ${total}. ${title}`}
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
          <Defs>
            <LinearGradient id="dayRing" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradient[0]} />
              <Stop offset="1" stopColor={gradient[gradient.length - 1]} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.neutral800} strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#dayRing)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] })}
            opacity={done ? 1 : 0}
          />
        </Svg>
        <Text heading weight="semibold" size={20}>
          {done}/{total}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text heading weight="semibold" size={17}>
          {title}
        </Text>
        <Text tone="muted" size={13}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

/** Écran vide : l'arche du logo flotte doucement, avec une phrase sympa. */
export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  const float = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const t = setTimeout(() => {
      if (!reduce.current) loop.start();
    }, 50);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, []);

  return (
    <View style={{ alignItems: "center", paddingVertical: space.lg, paddingHorizontal: space.md, gap: space.sm }}>
      <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>
        <PasserelleArch width={96} />
      </Animated.View>
      <Text heading weight="semibold" size={16} center>
        {title}
      </Text>
      {detail ? (
        <Text tone="muted" size={13} center>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
