import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listHabits, setAuthTokenGetter, setBaseUrl, setExtraHeadersGetter } from "@workspace/api-client-react";
import { habitCalendarRequestHeaders } from "@workspace/habit-dates";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useLayoutEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClerkAuthScreen } from "@/components/AuthScreen";
import { API_URL } from "@/lib/config";
import { initializeAdMob } from "@/lib/admob";
import { configureNotifications, rescheduleAllReminders } from "@/lib/reminders";

setBaseUrl(API_URL);

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RootLayoutNav() {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  // Wire Clerk session JWT before child layout effects run queries (avoids first fetch without Authorization).
  useLayoutEffect(() => {
    setAuthTokenGetter(() => getToken());
    setExtraHeadersGetter(() => habitCalendarRequestHeaders());
    return () => {
      setAuthTokenGetter(null);
      setExtraHeadersGetter(null);
    };
  }, [getToken]);

  // Flush React Query cache when the user signs out.
  const prevSignedInRef = React.useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    if (prevSignedInRef.current !== undefined && prevSignedInRef.current !== isSignedIn) {
      queryClient.cancelQueries();
      queryClient.clear();
    }
    prevSignedInRef.current = isSignedIn;
  }, [isSignedIn, isLoaded]);

  useEffect(() => {
    if (!isSignedIn || Platform.OS === "web") return;
    let cancelled = false;
    configureNotifications();
    (async () => {
      try {
        const habits = await listHabits();
        if (cancelled) return;
        await rescheduleAllReminders(habits);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as { route?: string };
      if (data.route === "today") {
        try {
          router.navigate("/(tabs)" as never);
        } catch {
          // ignore route errors
        }
      }
    });
    return () => sub.remove();
  }, []);

  if (!isLoaded) return null;
  if (!isSignedIn) return <ClerkAuthScreen />;
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      void initializeAdMob();
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const cream = "#f8f0dc";
      document.documentElement.style.backgroundColor = cream;
      document.body.style.backgroundColor = cream;
      document.body.style.colorScheme = "light";
      const root = document.getElementById("root");
      if (root) root.style.backgroundColor = cream;
    }
  }, []);

  if (Platform.OS !== "web" && !fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ClerkProvider
                publishableKey={publishableKey}
                tokenCache={tokenCache}
                proxyUrl={proxyUrl}
              >
                <ClerkLoaded>
                  <RootLayoutNav />
                </ClerkLoaded>
              </ClerkProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
