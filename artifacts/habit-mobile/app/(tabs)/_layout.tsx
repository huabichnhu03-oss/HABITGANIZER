import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { headingTextTransform, useTranslation } from "@/i18n";

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";
  const { t, locale } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: "Inter_700Bold",
          fontSize: 11,
          marginTop: 2,
          textTransform: headingTextTransform(locale),
          letterSpacing: 0.5,
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 3,
          borderTopColor: colors.foreground,
          elevation: 0,
          height: isWeb ? 84 : 90,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: colors.card }} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.today"),
          tabBarIcon: ({ color }) => (
            <Feather name="check-circle" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: t("nav.habits"),
          tabBarIcon: ({ color }) => (
            <Feather name="list" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t("nav.stats"),
          tabBarIcon: ({ color }) => (
            <Feather name="bar-chart-2" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: t("nav.health"),
          tabBarIcon: ({ color }) => (
            <Feather name="heart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pups"
        options={{
          title: t("nav.pups"),
          tabBarIcon: ({ color }) => (
            <Feather name="github" size={24} color={color} />
          ),
        }}
      />
      {/* Reachable from Settings — kept off the crowded tab bar */}
      <Tabs.Screen
        name="history"
        options={{
          href: null,
          title: t("nav.history"),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          href: null,
          title: t("nav.friends"),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          href: null,
          title: t("nav.ranks"),
        }}
      />
    </Tabs>
  );
}
