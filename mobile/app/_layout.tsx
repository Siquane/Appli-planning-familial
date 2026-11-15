import { useEffect, useCallback, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { Stack, router } from "expo-router";
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
import { resetBilling } from "../src/lib/billing";
import { activeScheme, applyTheme, color } from "../src/theme/tokens";
import { useThemeStore } from "../src/state/themeStore";

initSentry();
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold });
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  // Clair ou sombre (choix du profil) : la palette est changée avant le rendu
  // des écrans, qui sont remontés (clé = thème) pour la relire.
  const scheme = useThemeStore((s) => s.scheme);
  if (scheme !== activeScheme()) applyTheme(scheme);
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(color.bg).catch(() => {});
  }, [scheme]);

  useEffect(() => {
    // Wake the free-tier API server early so signup/login doesn't wait on a cold start.
    wakeServer();
    hydrate();
    hydrateOnboarding();
    hydrateTheme();
  }, [hydrate, hydrateOnboarding, hydrateTheme]);

  // Pick up screens published since this APK was installed (EAS Update).
  useEffect(() => {
    applyPendingUpdate();
  }, []);

  const ready = fontsLoaded && hydrated && onboardingHydrated && themeHydrated;

  // Session lost while a screen is open (refresh token rejected): go back to
  // the login screen instead of leaving every action failing with a 401.
  const user = useAuthStore((s) => s.user);
  const hadUser = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (user) {
      hadUser.current = true;
    } else if (hadUser.current) {
      hadUser.current = false;
      queryClient.clear();
      resetBilling();
      router.replace("/(auth)/login");
    }
  }, [ready, user]);

  const onLayout = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView key={scheme} style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar style={scheme === "light" ? "dark" : "light"} />
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
