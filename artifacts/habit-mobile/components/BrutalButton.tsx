import React from "react";
import {
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface BrutalButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  background?: string;
  textColor?: string;
  shadowOffset?: number;
  size?: "sm" | "md" | "lg";
  containerStyle?: ViewStyle;
}

export function BrutalButton({
  label,
  background,
  textColor,
  shadowOffset = 5,
  size = "md",
  containerStyle,
  ...rest
}: BrutalButtonProps) {
  const colors = useColors();
  const bg = background ?? colors.primary;
  const fg = textColor ?? colors.primaryForeground;

  const padding =
    size === "sm"
      ? { paddingVertical: 8, paddingHorizontal: 14 }
      : size === "lg"
      ? { paddingVertical: 16, paddingHorizontal: 24 }
      : { paddingVertical: 12, paddingHorizontal: 18 };

  const fontSize = size === "sm" ? 13 : size === "lg" ? 17 : 15;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <View
        style={[
          styles.shadow,
          {
            backgroundColor: colors.foreground,
            top: shadowOffset,
            left: shadowOffset,
            borderRadius: 14,
          },
        ]}
      />
      <Pressable
        {...rest}
        style={({ pressed }) => [
          styles.button,
          padding,
          {
            backgroundColor: bg,
            borderColor: colors.foreground,
            borderRadius: 14,
            transform: pressed
              ? [{ translateX: shadowOffset / 2 }, { translateY: shadowOffset / 2 }]
              : [],
          },
        ]}
      >
        <Text
          style={{
            color: fg,
            fontFamily: "Inter_800ExtraBold",
            fontSize,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    alignSelf: "flex-start",
  },
  shadow: {
    position: "absolute",
    right: 0,
    bottom: 0,
  },
  button: {
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
