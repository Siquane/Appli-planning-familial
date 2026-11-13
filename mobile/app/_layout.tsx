import { useEffect, useCallback } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { persistOptions, queryClient } from "../src/lib/queryClient";
import { useAuthStore, wakeServer } from "../src/state/authStore";
import { useOnboardingStore } from "../src/state/onboardingStore";
import { Toast } from "../src/components/Toast";
import { applyPendingUpdate } from "../src/lib/updates";
import { initSentry, Sentry, sentryEnabled } from "../src/lib/sentry";
import { color } from "../src/theme/tokens";

initSentry();
SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(color.bg).catch(() => {});

function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold });
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);

  useEffect(() => {
    // Wake the free-tier API server early so signup/login doesn't wait on a cold start.
    wakeServer();
    hydrate();
    hydrateOnboarding();
  }, [hydrate, hydrateOnboarding]);

  // Pick up screens published since this APK was installed (EAS Update).
  useEffect(() => {
    applyPendingUpdate();
  }, []);

  const ready = fontsLoaded && hydrated && onboardingHydrated;

  const onLayout = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
          <Toast />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default sentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;
