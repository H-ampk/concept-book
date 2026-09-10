export type ThemeMode = "light" | "dark" | "system";

export type ThemeColors = {
  background: string;
  header: string;
  button: string;
  selectedButton: string;
};

export type ThemeSettings = {
  mode: ThemeMode;
  colors: ThemeColors;
};

export type ResolvedThemeMode = "light" | "dark";
