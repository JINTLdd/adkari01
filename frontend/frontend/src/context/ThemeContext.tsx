import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";

export const COLORS = {
  day: {
    bg: "#355070",
    surface: "#46658A",
    surfaceAlt: "#3D5A7C",
    textPrimary: "#FFFFFF",
    textSecondary: "#E2E8F0",
  },
  night: {
    bg: "#2D2438",
    surface: "#413451",
    surfaceAlt: "#3A2E48",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
  },
  gold: "#D4AF37",
  goldLight: "#F2D77D",
  copper: "#B87333",
  success: "#10B981",
};

type ThemeMode = "day" | "night";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: typeof COLORS.day;
  toggle: () => void;
  isLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "day",
  colors: COLORS.day,
  toggle: () => {},
  isLoaded: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>("day");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>("theme_mode", "day");
      if (saved === "night" || saved === "day") setMode(saved);
      setIsLoaded(true);
    })();
  }, []);

  const toggle = () => {
    setMode((prev) => {
      const next = prev === "day" ? "night" : "day";
      storage.setItem("theme_mode", next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider
      value={{ mode, colors: mode === "day" ? COLORS.day : COLORS.night, toggle, isLoaded }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
