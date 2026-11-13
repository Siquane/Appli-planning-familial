import { FlexWidget, TextWidget } from "react-native-android-widget";
import { color } from "../theme/tokens";
import type { WidgetContent } from "./content";

// How a widget looks: the app's dark card, a coloured title (its pillar) and
// a few lines. A tap opens the matching screen of the app.

type Hex = `#${string}`;

const ROW_COLOR: Record<string, Hex> = {
  faint: color.neutral600 as Hex,
  strong: color.text as Hex,
  danger: color.danger as Hex,
  normal: color.neutral300 as Hex,
};

export function WidgetCard({ content, accent, uri }: { content: WidgetContent; accent: string; uri: string }) {
  const rows = content.rows.length > 0 ? content.rows : [{ text: content.empty ?? "", tone: "faint" as const }];
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: color.surface as Hex,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: (color.neutral900 as Hex) ?? "#292b31",
        padding: 14,
        flexDirection: "column",
        flexGap: 6,
      }}
    >
      <TextWidget text={content.title} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: "600", color: accent as Hex }} />
      {rows.map((r, i) => (
        <TextWidget key={i} text={r.text} maxLines={1} truncate="END" style={{ fontSize: 14, color: ROW_COLOR[r.tone ?? "normal"], fontWeight: r.tone === "strong" ? "600" : "400" }} />
      ))}
    </FlexWidget>
  );
}

export function SignedOutCard() {
  return (
    <WidgetCard
      content={{ title: "Passerelle", rows: [{ text: "Ouvre l'appli pour afficher tes infos", tone: "faint" }] }}
      accent={color.pillar1}
      uri="passerelle:///home"
    />
  );
}
