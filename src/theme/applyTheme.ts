import {
  contrastTextColor,
  deriveActiveColor,
  deriveHeaderDeepColor,
  deriveHoverColor
} from "./color";
import { resolveThemeColors } from "./defaults";
import { loadThemeSettings } from "./storage";
import type { ResolvedThemeMode, ThemeSettings } from "./types";

const setVar = (el: HTMLElement, name: string, value: string): void => {
  el.style.setProperty(name, value);
};

export const getSystemThemeMode = (): ResolvedThemeMode => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const resolveThemeMode = (mode: ThemeSettings["mode"]): ResolvedThemeMode =>
  mode === "system" ? getSystemThemeMode() : mode;

export const applyThemeSettings = (
  settings: ThemeSettings,
  resolvedMode: ResolvedThemeMode = resolveThemeMode(settings.mode)
): void => {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  const colors = resolveThemeColors(settings.colors, resolvedMode);

  root.dataset.theme = resolvedMode;
  root.style.colorScheme = resolvedMode;

  setVar(root, "--theme-background", colors.background);
  setVar(root, "--theme-header", colors.header);
  setVar(root, "--theme-header-deep", deriveHeaderDeepColor(colors.header));
  setVar(root, "--theme-header-text", contrastTextColor(colors.header));
  setVar(root, "--theme-button", colors.button);
  setVar(root, "--theme-button-hover", deriveHoverColor(colors.button));
  setVar(root, "--theme-button-active", deriveActiveColor(colors.button));
  setVar(root, "--theme-button-text", contrastTextColor(colors.button));
  setVar(root, "--theme-button-selected", colors.selectedButton);
  setVar(root, "--theme-button-selected-hover", deriveHoverColor(colors.selectedButton));
  setVar(root, "--theme-button-selected-text", contrastTextColor(colors.selectedButton));

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", colors.header);
  }
};

export const hydrateTheme = (): void => {
  applyThemeSettings(loadThemeSettings());
};
