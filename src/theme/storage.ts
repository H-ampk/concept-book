import { defaultColorsForMode, DEFAULT_THEME_MODE, LIGHT_THEME_COLORS } from "./defaults";
import { normalizeHexColor } from "./color";
import type { ThemeColors, ThemeMode, ThemeSettings } from "./types";

export const THEME_SETTINGS_STORAGE_KEY = "concept-book-theme-settings";

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

export const normalizeThemeSettings = (input: unknown): ThemeSettings => {
  const fallbackColors = { ...LIGHT_THEME_COLORS };
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { mode: DEFAULT_THEME_MODE, colors: fallbackColors };
  }
  const raw = input as Record<string, unknown>;
  const mode: ThemeMode = isThemeMode(raw.mode) ? raw.mode : DEFAULT_THEME_MODE;
  const rawColors =
    typeof raw.colors === "object" && raw.colors !== null && !Array.isArray(raw.colors)
      ? (raw.colors as Record<string, unknown>)
      : raw;

  const palette = defaultColorsForMode(mode === "dark" ? "dark" : "light");
  const colors: ThemeColors = {
    background: normalizeHexColor(rawColors.background, palette.background),
    header: normalizeHexColor(rawColors.header, palette.header),
    button: normalizeHexColor(rawColors.button, palette.button),
    selectedButton: normalizeHexColor(rawColors.selectedButton, palette.selectedButton)
  };

  return { mode, colors };
};

export const loadThemeSettings = (): ThemeSettings => {
  try {
    const raw = localStorage.getItem(THEME_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { mode: DEFAULT_THEME_MODE, colors: { ...LIGHT_THEME_COLORS } };
    }
    return normalizeThemeSettings(JSON.parse(raw) as unknown);
  } catch {
    return { mode: DEFAULT_THEME_MODE, colors: { ...LIGHT_THEME_COLORS } };
  }
};

export const saveThemeSettings = (settings: ThemeSettings): void => {
  try {
    const normalized = normalizeThemeSettings(settings);
    localStorage.setItem(THEME_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Storage access failure must not break ConceptBook.
  }
};
