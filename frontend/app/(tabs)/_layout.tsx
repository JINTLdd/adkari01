import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Amiri_400Regular, Amiri_700Bold } from "@expo-google-fonts/amiri";
import { useTheme, COLORS } from "@/src/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, ActivityIndicator } from "react-native";

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    Amiri_400Regular,
    Amiri_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  // Reserve space for system navigation bar / gesture handle.
  const bottomPad = Math.max(insets.bottom, 12) + 10;
  const tabHeight = 60 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: "rgba(212,175,55,0.25)",
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomPad,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="adhan"
        options={{
          title: "الأذان",
          tabBarIcon: ({ color, size }) => <Ionicons name="alarm" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasbih"
        options={{
          title: "المسبحة",
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipse" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "المزيد",
          tabBarIcon: ({ color, size }) => <Ionicons name="apps" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "الإعدادات",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
