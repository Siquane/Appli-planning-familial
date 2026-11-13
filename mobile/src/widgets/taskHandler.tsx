import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { loadSnapshot } from "./snapshot";
import { renderWidget } from "./render";

// Runs in the background when Android asks a widget to draw itself (added,
// resized, every 30 minutes). Taps open the app through the widget's link.
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget: draw }: WidgetTaskHandlerProps) {
  if (widgetAction === "WIDGET_DELETED" || widgetAction === "WIDGET_CLICK") return;
  const snapshot = await loadSnapshot();
  draw(renderWidget(widgetInfo.widgetName, snapshot));
}
