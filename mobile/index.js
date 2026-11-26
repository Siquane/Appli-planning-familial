// App entry: Expo Router, plus the handler Android calls to draw the
// home-screen widgets (it runs even when the app is closed).
import "expo-router/entry";
import { Platform } from "react-native";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./src/widgets/taskHandler";

// Les widgets n'existent que sur Android (la version web sert aux essais).
if (Platform.OS === "android") registerWidgetTaskHandler(widgetTaskHandler);
