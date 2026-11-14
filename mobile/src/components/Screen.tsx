import { ReactElement, ReactNode } from "react";
import { RefreshControlProps, ScrollView, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { color, gutter } from "../theme/tokens";
import { KeyboardScrollView } from "./KeyboardScrollView";

// Nocturne's "tech-grid" background — a faint cyan grid, applied on Home and
// Replan per the DC template's `.tech-grid` class. RN has no repeating
// background-image, so the grid is drawn as an absolutely-positioned overlay
// of thin lines at a fixed pitch (22px, matching the CSS background-size).
function TechGridOverlay() {
  const pitch = 22;
  const count = 40;
  return (
    <View pointerEvents="none" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={`v${i}`} style={{ position: "absolute", left: i * pitch, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(34,229,255,0.05)" }} />
      ))}
      {Array.from({ length: count }).map((_, i) => (
        <View key={`h${i}`} style={{ position: "absolute", top: i * pitch, left: 0, right: 0, height: 1, backgroundColor: "rgba(34,229,255,0.05)" }} />
      ))}
    </View>
  );
}

interface Props {
  children: ReactNode;
  scroll?: boolean;
  techGrid?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  edges?: ("top" | "bottom" | "left" | "right")[];
  refreshControl?: ReactElement<RefreshControlProps>;
  /**
   * Form screens: lift the content above the on-screen keyboard and let it
   * scroll, so fields and the submit button stay reachable. Android draws
   * edge-to-edge (forced since Expo 53), so the OS no longer resizes the
   * window for us. The content still fills the screen, so `justifyContent`
   * in `style` keeps working.
   */
  keyboard?: boolean;
}

export function Screen({ children, scroll = true, techGrid, padded = true, style, edges = ["top", "bottom"], refreshControl, keyboard }: Props) {
  if (keyboard) {
    return (
      <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: color.bg }}>
        {techGrid && <TechGridOverlay />}
        <KeyboardScrollView
          contentContainerStyle={[{ flexGrow: 1, padding: padded ? 22 : 0, gap: gutter }, style]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </KeyboardScrollView>
      </SafeAreaView>
    );
  }

  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: color.bg }}>
      {techGrid && <TechGridOverlay />}
      <Container
        {...(scroll
          ? { contentContainerStyle: [{ padding: padded ? 22 : 0, gap: gutter }, style], showsVerticalScrollIndicator: false, refreshControl }
          : { style: [{ flex: 1, padding: padded ? 22 : 0, gap: gutter }, style] })}
      >
        {children}
      </Container>
    </SafeAreaView>
  );
}
