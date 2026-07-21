import React from "react";
import { StyleSheet, View, ViewProps, ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

interface BrutalCardProps extends ViewProps {
  background?: string;
  shadowOffset?: number;
  borderWidth?: number;
  radius?: number;
  containerStyle?: ViewStyle;
}

export function BrutalCard({
  background,
  shadowOffset = 6,
  borderWidth = 3,
  radius,
  containerStyle,
  style,
  children,
  ...rest
}: BrutalCardProps) {
  const colors = useColors();
  const bg = background ?? colors.card;
  const r = radius ?? colors.radius;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <View
        style={[
          styles.shadow,
          {
            backgroundColor: colors.foreground,
            top: shadowOffset,
            left: shadowOffset,
            borderRadius: r,
          },
        ]}
      />
      <View
        style={[
          {
            backgroundColor: bg,
            borderColor: colors.foreground,
            borderWidth,
            borderRadius: r,
          },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  shadow: {
    position: "absolute",
    right: 0,
    bottom: 0,
  },
});
