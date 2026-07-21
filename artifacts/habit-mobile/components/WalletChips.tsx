import { Feather } from "@expo/vector-icons";
import { useGetWallet } from "@workspace/api-client-react";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export function WalletChips() {
  const colors = useColors();
  const { data } = useGetWallet();
  const coins = data?.coins ?? 0;
  const food = data?.food ?? 0;
  const water = data?.water ?? 0;
  const chip = (
    icon: React.ComponentProps<typeof Feather>["name"],
    value: number,
    bg: string,
    testID: string,
  ) => (
    <View
      testID={testID}
      style={[styles.chip, { backgroundColor: bg, borderColor: colors.foreground }]}
    >
      <Feather name={icon} size={14} color={colors.foreground} />
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
  return (
    <View style={styles.row}>
      {chip("circle", coins, colors.accent, "wallet-coins")}
      {chip("box", food, colors.primary, "wallet-food")}
      {chip("droplet", water, "#a8d6f0", "wallet-water")}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2,
  },
  value: { fontFamily: "Inter_900Black", fontSize: 13 },
});
