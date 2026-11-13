import { useEffect, useCallback, useRef } from "react";
import { Stack, router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { queryClient } from "../src/lib/queryClient";
import { useAuthStore, wakeServer } from "../src/state/authStore";
import { useOnboardingStore } from "../src/state/onboardingStore";
import { Toast } from "../src/components/Toast";
import { resetBilling } from "../src/lib/billing";
import { color } from "../src/theme/tokens";

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(color.bg).catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
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

  const ready = fontsLoaded && hydrated && onboardingHydrated;

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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
