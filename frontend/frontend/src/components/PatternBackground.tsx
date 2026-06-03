import React from "react";
import { ImageBackground, StyleSheet, ImageSourcePropType, View } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";

const BG_DAY = "https://static.prod-images.emergentagent.com/jobs/dce11d34-2ba4-4431-b8a4-c4429f74ac6d/images/479150ae83126462622680af692f833bf5338320e2ace7c8bd9d8d6b1312c494.png";
const BG_NIGHT = "https://static.prod-images.emergentagent.com/jobs/dce11d34-2ba4-4431-b8a4-c4429f74ac6d/images/38b4c2660d186a55ee6ab1c1ebc4f40f0684afaaf3473681d64dc024f6b3a49d.png";

interface Props {
  children: React.ReactNode;
  opacity?: number;
}

export const PatternBackground: React.FC<Props> = ({ children, opacity = 0.12 }) => {
  const { mode, colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ImageBackground
        source={{ uri: mode === "day" ? BG_DAY : BG_NIGHT }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        imageStyle={{ opacity }}
      />
      <View style={styles.root}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});
