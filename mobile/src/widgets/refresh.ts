import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { saveSnapshot, WIDGET_NAMES, type WidgetSnapshot } from "./snapshot";
import { renderWidget } from "./render";

/** Saves the snapshot and redraws every widget placed on the home screen. */
export async function refreshWidgets(snapshot: WidgetSnapshot | null): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await saveSnapshot(snapshot);
    await Promise.all(WIDGET_NAMES.map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: () => renderWidget(widgetName, snapshot) })));
  } catch {
    // A widget that can't redraw must never break the app.
  }
}

