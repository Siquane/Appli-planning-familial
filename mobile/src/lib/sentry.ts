import * as Sentry from "@sentry/react-native";

// Crash and error reports (sentry.io). The DSN is the project's public
// address (it ships inside the app anyway), not a secret. Kept here rather
// than in app.json so setting it is a plain EAS Update, no new APK. While it
// is empty, nothing is sent. Turned off in development.
const dsn: string = "";

export const sentryEnabled = dsn.length > 0 && !__DEV__;

export function initSentry() {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn,
    // Only errors: no performance tracing, no screenshots, no personal data.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    environment: "preview",
  });
}

export { Sentry };
