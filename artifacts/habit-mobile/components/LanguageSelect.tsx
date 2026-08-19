import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { LOCALES, useTranslation, type Locale } from "@/i18n";
import { useColors } from "@/hooks/useColors";

export function LanguageSelect() {
  const colors = useColors();
  const { t, locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = LOCALES.find((item) => item.code === locale) ?? LOCALES[0];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.foreground }]}>{t("language.choosePrompt")}</Text>
      <Pressable
        testID="language-select"
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.trigger,
          {
            borderColor: colors.foreground,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Text style={[styles.triggerText, { color: colors.foreground }]}>{selected.nativeName}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.foreground} />
      </Pressable>
      {open
        ? LOCALES.map((item) => {
            const active = item.code === locale;
            return (
              <Pressable
                key={item.code}
                testID={`language-option-${item.code}`}
                onPress={() => {
                  setLocale(item.code as Locale);
                  setOpen(false);
                }}
                style={[
                  styles.option,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: active ? colors.primary : colors.card,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: active ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {item.nativeName}
                </Text>
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontFamily: "Inter_900Black", fontSize: 11, letterSpacing: 0.6 },
  trigger: {
    minHeight: 48,
    borderWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerText: { fontFamily: "Inter_800ExtraBold", fontSize: 15 },
  option: {
    minHeight: 44,
    borderWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  optionText: { fontFamily: "Inter_800ExtraBold", fontSize: 14 },
});
