import { FlexWidget, TextWidget } from "react-native-android-widget";
import { darkColor as color } from "../theme/tokens";
import type { WidgetContent } from "./content";
import type { WidgetSnapshot } from "./snapshot";
import { widgetUri } from "./links";

// How a widget looks: the app's dark card, a coloured title (its pillar) and
// a few lines. A tap opens the matching screen of the app.

type Hex = `#${string}`;

const ROW_COLOR: Record<string, Hex> = {
  faint: color.neutral600 as Hex,
  strong: color.text as Hex,
  danger: color.danger as Hex,
  normal: color.neutral300 as Hex,
};

// Sizes stay readable down to a 2 × 2 widget: long lines are cut with « … ».
const TITLE_SIZE = 15;
const ROW_SIZE = 16;

export function WidgetCard({ content, accent, uri }: { content: WidgetContent; accent: string; uri: string }) {
  const empty = content.rows.length === 0;
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
        flexGap: 7,
      }}
    >
      <TextWidget
        text={content.title}
        maxLines={1}
        truncate="END"
        style={{ width: "match_parent", textAlign: "center", fontSize: TITLE_SIZE, fontWeight: "700", color: accent as Hex, marginBottom: 2 }}
      />
      {content.rows.map((r, i) => {
        const tone = ROW_COLOR[r.tone ?? "normal"];
        const weight = r.tone === "strong" ? "600" : "400";
        if (!r.aside) {
          return <TextWidget key={i} text={r.text} maxLines={1} truncate="END" style={{ fontSize: ROW_SIZE, color: tone, fontWeight: weight }} />;
        }
        // Task on the left, who it's for on the right.
        return (
          <FlexWidget key={i} style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8 }}>
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget text={r.text} maxLines={1} truncate="END" style={{ fontSize: ROW_SIZE, color: tone, fontWeight: weight }} />
            </FlexWidget>
            <TextWidget text={r.aside} maxLines={1} truncate="END" style={{ fontSize: ROW_SIZE - 2, color: accent as Hex, fontWeight: "500" }} />
          </FlexWidget>
        );
      })}
      {empty && <TextWidget text={content.empty ?? ""} maxLines={1} truncate="END" style={{ width: "match_parent", textAlign: "center", fontSize: ROW_SIZE, color: ROW_COLOR.normal }} />}
      {empty && content.example && content.example.length > 0 && (
        <TextWidget text="Exemple · touche pour remplir" maxLines={1} style={{ width: "match_parent", textAlign: "center", fontSize: 12, color: ROW_COLOR.faint, fontStyle: "italic" }} />
      )}
      {empty &&
        content.example?.map((text, i) => (
          <TextWidget key={`ex${i}`} text={text} maxLines={1} truncate="END" style={{ fontSize: ROW_SIZE - 1, color: ROW_COLOR.faint, fontStyle: "italic" }} />
        ))}
    </FlexWidget>
  );
}

export function SignedOutCard() {
  return (
    <WidgetCard
      content={{ title: "Passerelle", rows: [{ text: "Ouvre l'appli pour afficher tes infos", tone: "faint" }] }}
      accent={color.pillar1}
      uri={widgetUri("planning")}
    />
  );
}

/** A button, not a list: « + Ajouter une tâche », one tap from the new-task form. */
export function AddTaskCard() {
  const accent = color.pillar1 as Hex;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: widgetUri("add-task") }}
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: color.surface as Hex,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: (color.neutral900 as Hex) ?? "#292b31",
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        flexGap: 10,
      }}
    >
      <FlexWidget style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: accent, alignItems: "center", justifyContent: "center" }}>
        <TextWidget text="+" style={{ fontSize: 22, fontWeight: "600", color: accent }} />
      </FlexWidget>
      <TextWidget text="Ajouter une tâche" maxLines={1} truncate="END" style={{ fontSize: 16, fontWeight: "700", color: color.text as Hex }} />
    </FlexWidget>
  );
}

/**
 * Notes : les dernières notes (épinglées d'abord). Un appui sur une note l'ouvre,
 * le « + » en écrit une nouvelle, le titre ouvre la liste.
 */
export function NotesCard({ notes }: { notes: NonNullable<WidgetSnapshot["notes"]> }) {
  const accent = color.pillar4 as Hex;
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: color.surface as Hex,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: color.neutral900 as Hex,
        padding: 14,
        flexDirection: "column",
        flexGap: 8,
      }}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: widgetUri("notes") }} style={{ flex: 1 }}>
          <TextWidget text="Notes" maxLines={1} style={{ fontSize: TITLE_SIZE, fontWeight: "700", color: accent }} />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: widgetUri("add-note") }}
          style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: accent, alignItems: "center", justifyContent: "center" }}
        >
          <TextWidget text="+" style={{ fontSize: 19, fontWeight: "600", color: accent }} />
        </FlexWidget>
      </FlexWidget>
      {notes.length === 0 && (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: widgetUri("add-note") }} style={{ width: "match_parent", flexDirection: "column", flexGap: 4 }}>
          <TextWidget text="Aucune note pour l'instant" maxLines={1} truncate="END" style={{ fontSize: ROW_SIZE, color: ROW_COLOR.normal }} />
          <TextWidget text="Touche + pour en écrire une" maxLines={1} truncate="END" style={{ fontSize: 13, color: ROW_COLOR.faint, fontStyle: "italic" }} />
        </FlexWidget>
      )}
      {notes.map((n) => (
        <FlexWidget
          key={n.id}
          clickAction="OPEN_URI"
          clickActionData={{ uri: widgetUri(`note/${n.id}`) }}
          style={{ width: "match_parent", flexDirection: "column", backgroundColor: color.neutral900 as Hex, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <TextWidget
            text={`${n.pinned ? "📌 " : ""}${n.heading}${n.shared ? "" : " · perso"}`}
            maxLines={1}
            truncate="END"
            style={{ fontSize: ROW_SIZE - 1, fontWeight: "600", color: ROW_COLOR.strong }}
          />
          {n.preview ? <TextWidget text={n.preview} maxLines={1} truncate="END" style={{ fontSize: 13, color: ROW_COLOR.faint }} /> : null}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
