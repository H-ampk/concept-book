import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { applyThemeSettings, getSystemThemeMode, resolveThemeMode } from "./applyTheme";
import { defaultColorsForMode, themeColorsEqual } from "./defaults";
import { isThemeHexColor } from "./color";
import { loadThemeSettings, saveThemeSettings } from "./storage";
import type { ResolvedThemeMode, ThemeColors, ThemeMode, ThemeSettings } from "./types";

type ThemeContextValue = {
  settings: ThemeSettings;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: ThemeMode) => void;
  setColor: (key: keyof ThemeColors, value: string) => void;
  resetColors: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const persist = (next: ThemeSettings): ThemeSettings => {
  saveThemeSettings(next);
  return next;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<ThemeSettings>(() => loadThemeSettings());
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(() => getSystemThemeMode());

  const resolvedMode: ResolvedThemeMode =
    settings.mode === "system" ? systemMode : settings.mode;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemMode(mql.matches ? "dark" : "light");
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    applyThemeSettings(settings, resolvedMode);
  }, [resolvedMode, settings]);

  const setMode = useCallback((mode: ThemeMode) => {
    setSettings((current) => {
      const resolved = mode === "system" ? getSystemThemeMode() : mode;
      const matchesDefault =
        themeColorsEqual(current.colors, defaultColorsForMode("light")) ||
        themeColorsEqual(current.colors, defaultColorsForMode("dark"));
      return persist({
        mode,
        colors: matchesDefault ? defaultColorsForMode(resolved) : current.colors
      });
    });
  }, []);

  const setColor = useCallback((key: keyof ThemeColors, value: string) => {
    if (!isThemeHexColor(value)) {
      return;
    }
    setSettings((current) =>
      persist({
        ...current,
        colors: { ...current.colors, [key]: value.toUpperCase() }
      })
    );
  }, []);

  const resetColors = useCallback(() => {
    setSettings((current) => {
      const resolved = resolveThemeMode(current.mode);
      return persist({ ...current, colors: defaultColorsForMode(resolved) });
    });
  }, []);

  const value = useMemo(
    () => ({ settings, resolvedMode, setMode, setColor, resetColors }),
    [resetColors, resolvedMode, setColor, setMode, settings]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
};
