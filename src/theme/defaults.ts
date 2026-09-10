import type { ThemeColors, ThemeMode } from "./types";

/** 現在の ConceptBook ライト外観（Danish Study Library） */
export const LIGHT_THEME_COLORS: ThemeColors = {
  background: "#F5F0E8",
  header: "#587487",
  button: "#5E7E93",
  selectedButton: "#8CA9BA"
};

/** Nordic / Danish Study Library の暗色テーマ */
export const DARK_THEME_COLORS: ThemeColors = {
  background: "#182028",
  header: "#3A5060",
  button: "#5E7E93",
  selectedButton: "#8CA9BA"
};

export const THEME_COLOR_PRESETS: Record<keyof ThemeColors, string[]> = {
  background: ["#F5F0E8", "#FFFDF8", "#182028", "#1C262E"],
  header: ["#587487", "#4E6879", "#3A5060", "#6C8AA0"],
  button: ["#5E7E93", "#516F82", "#B89D7B", "#6C8AA0"],
  selectedButton: ["#8CA9BA", "#C5AE86", "#6D8FA3", "#5E7E93"]
};

export const DEFAULT_THEME_MODE: ThemeMode = "light";

export const defaultColorsForMode = (mode: "light" | "dark"): ThemeColors =>
  mode === "dark" ? { ...DARK_THEME_COLORS } : { ...LIGHT_THEME_COLORS };

export const themeColorsEqual = (a: ThemeColors, b: ThemeColors): boolean =>
  a.background.toUpperCase() === b.background.toUpperCase() &&
  a.header.toUpperCase() === b.header.toUpperCase() &&
  a.button.toUpperCase() === b.button.toUpperCase() &&
  a.selectedButton.toUpperCase() === b.selectedButton.toUpperCase();

/** 未カスタム（light/dark 標準値）なら現在モードの標準色、カスタム済みならそのまま */
export const resolveThemeColors = (
  colors: ThemeColors,
  resolvedMode: "light" | "dark"
): ThemeColors => {
  const matchesDefault =
    themeColorsEqual(colors, LIGHT_THEME_COLORS) || themeColorsEqual(colors, DARK_THEME_COLORS);
  if (matchesDefault) {
    return defaultColorsForMode(resolvedMode);
  }
  return colors;
};
