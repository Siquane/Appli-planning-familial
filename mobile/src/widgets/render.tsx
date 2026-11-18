import { darkColor as color } from "../theme/tokens";
import { menuContent, shoppingContent, summaryContent, tasksContent } from "./content";
import type { WidgetName, WidgetSnapshot } from "./snapshot";
import { AddTaskCard, NotesCard, SignedOutCard, WidgetCard } from "./views";
import { widgetUri } from "./links";

/** The widget named `name`, drawn from the saved snapshot at time `now`. */
export function renderWidget(name: string, snapshot: WidgetSnapshot | null, now: Date = new Date()) {
  // The « add a task » button needs no data: signed out, the app opens on its login screen.
  if (name === "AjoutTache") return <AddTaskCard />;
  if (!snapshot) return <SignedOutCard />;
  switch (name as WidgetName) {
    case "Notes":
      return <NotesCard notes={snapshot.notes ?? []} />;
    case "Taches":
      return <WidgetCard content={tasksContent(snapshot, now)} accent={color.pillar1} uri={widgetUri("planning")} />;
    case "Menu":
      return <WidgetCard content={menuContent(snapshot, now)} accent={color.pillar2} uri={widgetUri("menu")} />;
    case "Courses":
      return <WidgetCard content={shoppingContent(snapshot)} accent={color.pillar2} uri={widgetUri("courses")} />;
    case "Resume":
    default:
      return <WidgetCard content={summaryContent(snapshot, now)} accent={color.pillar1} uri={widgetUri("planning")} />;
  }
}
