import { useState, type ReactNode } from "react";
import { Pressable } from "./Touchable";
import { View } from "react-native";
import { Card } from "./Card";
import { Text } from "./Text";
import { ChevronRightIcon } from "./icons";
import { color, space } from "../theme/tokens";

interface Props {
  title: string;
  /** Shown under the title while folded, e.g. « 2 plats préférés · 1 allergie ». */
  summary?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

// A card that folds its content away, so long forms don't overload the screen.
export function Accordion({ title, summary, icon, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ gap: space[4] }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${open ? "replier" : "déplier"}`}
        style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}
      >
        {icon}
        <View style={{ flex: 1, gap: 2 }}>
          <Text size={15} weight="medium">
            {title}
          </Text>
          {!open && summary ? (
            <Text size={13} tone="faint">
              {summary}
            </Text>
          ) : null}
        </View>
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </View>
      </Pressable>
      {open ? <View style={{ gap: space[4] }}>{children}</View> : null}
    </Card>
  );
}
