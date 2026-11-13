import { color } from "../theme/tokens";
import { menuContent, shoppingContent, summaryContent, tasksContent } from "./content";
import type { WidgetName, WidgetSnapshot } from "./snapshot";
import { SignedOutCard, WidgetCard } from "./views";
import { widgetUri } from "./links";

/** The widget named `name`, drawn from the saved snapshot at time `now`. */
export function renderWidget(name: string, snapshot: WidgetSnapshot | null, now: Date = new Date()) {
  if (!snapshot) return <SignedOutCard />;
  switch (name as WidgetName) {
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
