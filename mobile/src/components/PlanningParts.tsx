import { ReactNode, useId } from "react";
import { ScrollView, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { Card } from "./Card";
import { MealIcon, StarIcon, WalletIcon } from "./icons";
import { color, gradient, radius, space } from "../theme/tokens";
import { starsLabel } from "../lib/stars";

// Pièces du Planning : l'anneau d'avancement, les bulles des membres,
// la carte résumé du haut et le trait de l'heure actuelle.

/** Anneau d'avancement ; sans `tint`, il prend le dégradé du logo. */
export function ProgressRing({ done, total, size, stroke, tint, children }: { done: number; total: number; size: number; stroke: number; tint?: string; children?: ReactNode }) {
  const id = `r${useId().replace(/:/g, "")}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total ? Math.min(1, done / total) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="1" stopColor={gradient[gradient.length - 1]} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.neutral800} strokeWidth={stroke} fill="none" />
        {ratio > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={tint ?? `url(#${id})`}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * ratio} ${c}`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

export interface Bubble {
  id: string;
  label: string;
  initial: string;
  tint: string;
  done: number;
  total: number;
}

/** « Tous » puis une bulle par membre ; toucher une bulle montre son planning. */
export function MemberBubbles({ bubbles, selectedId, onSelect, all }: { bubbles: Bubble[]; selectedId: string | null; onSelect: (id: string | null) => void; all: { done: number; total: number } }) {
  const item = (key: string, label: string, sub: string, selected: boolean, onPress: () => void, ring: ReactNode) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${sub.replace("/", " sur ")}`}
      style={{ alignItems: "center", gap: 3, width: 58 }}
    >
      {ring}
      <Text size={11} weight={selected ? "semibold" : "regular"} tone={selected ? "text" : "faint"} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs, flexGrow: 1, justifyContent: "space-between" }} accessibilityRole="tablist">
      {item(
        "all",
        "Toute la famille",
        `${all.done}/${all.total}`,
        selectedId === null,
        () => onSelect(null),
        <ProgressRing done={all.done} total={all.total} size={48} stroke={3.5}>
          <View style={[bubbleIn, { backgroundColor: selectedId === null ? color.accent800 : color.neutral900 }]}>
            <Text size={11} weight="semibold" style={{ color: selectedId === null ? color.accent100 : color.neutral400 }}>
              Tous
            </Text>
          </View>
        </ProgressRing>,
      )}
      {bubbles.map((b) => {
        const selected = selectedId === b.id;
        return item(
          b.id,
          b.label,
          `${b.done}/${b.total}`,
          selected,
          () => onSelect(selected ? null : b.id),
          <ProgressRing done={b.done} total={b.total} size={48} stroke={selected ? 4 : 3.5} tint={b.tint}>
            <View style={[bubbleIn, { backgroundColor: b.tint + (selected ? "4D" : "29"), ...(selected ? { boxShadow: `0 0 12px ${b.tint}80` } : null) }]}>
              <Text heading weight="semibold" size={14} style={{ color: selected ? color.text : b.tint }}>
                {b.initial}
              </Text>
            </View>
          </ProgressRing>,
        );
      })}
    </ScrollView>
  );
}

const bubbleIn = { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" } as const;

/** Carte du haut : la famille (repas du soir, budget) ou une personne (encouragement, étoiles). */
export function PlanningHero({
  done,
  total,
  tint,
  title,
  lines,
}: {
  done: number;
  total: number;
  /** Couleur de la personne choisie ; sans elle, le dégradé du logo. */
  tint?: string;
  title: string;
  lines: { kind: "meal" | "budget" | "stars" | "plain"; text: string; danger?: boolean; onPress?: () => void }[];
}) {
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md, paddingHorizontal: space.md, borderWidth: 1, borderColor: (tint ?? color.accent) + "40" }}>
      <ProgressRing done={done} total={total} size={70} stroke={7} tint={tint}>
        <Text heading weight="semibold" size={17} accessibilityLabel={`${done} sur ${total}`}>
          {done}/{total}
        </Text>
      </ProgressRing>
      <View style={{ flex: 1, gap: 4 }}>
        <Text heading weight="semibold" size={16}>
          {title}
        </Text>
        {lines.map((l, i) => {
          const icon =
            l.kind === "meal" ? <MealIcon size={14} color={color.pillar2} /> : l.kind === "budget" ? <WalletIcon size={14} color={l.danger ? color.danger : color.pillar3} /> : l.kind === "stars" ? <StarIcon size={14} color={color.amber} /> : null;
          const row = (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
              {icon}
              <Text size={13} numberOfLines={1} style={{ flex: 1, color: l.danger ? color.danger : l.kind === "stars" ? color.amber : l.kind === "plain" ? color.neutral500 : color.text }}>
                {l.text}
              </Text>
            </View>
          );
          return l.onPress ? (
            <Pressable key={i} onPress={l.onPress} accessibilityRole="button">
              {row}
            </Pressable>
          ) : (
            <View key={i}>{row}</View>
          );
        })}
      </View>
    </Card>
  );
}

export const starsLine = (n: number, today: boolean) => (n > 0 ? `${starsLabel(n)} à gagner ${today ? "aujourd'hui" : "ce jour-là"}` : "Toutes les étoiles sont gagnées !");

/** Trait lumineux de l'heure actuelle, entre les tâches. */
export function NowLine({ time }: { time: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginVertical: -2 }} accessibilityLabel={`Il est ${time}`}>
      <Text mono size={11} weight="semibold" style={{ color: color.accent }}>
        {time}
      </Text>
      <View style={{ flex: 1, height: 2, borderRadius: radius.sm, backgroundColor: color.accent, boxShadow: `0 0 8px ${color.accent}` }}>
        <View style={{ position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: color.accent }} />
      </View>
    </View>
  );
}
