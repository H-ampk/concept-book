import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DARK_THEME_COLORS, LIGHT_THEME_COLORS } from "./defaults";
import {
  THEME_SETTINGS_STORAGE_KEY,
  loadThemeSettings,
  normalizeThemeSettings,
  saveThemeSettings
} from "./storage";

const installLocalStorage = () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      }
    },
    configurable: true
  });
};

describe("theme settings storage", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("light / dark / system を復元する", () => {
    expect(normalizeThemeSettings({ mode: "light", colors: LIGHT_THEME_COLORS }).mode).toBe("light");
    expect(normalizeThemeSettings({ mode: "dark", colors: DARK_THEME_COLORS }).mode).toBe("dark");
    expect(normalizeThemeSettings({ mode: "system", colors: LIGHT_THEME_COLORS }).mode).toBe("system");
  });

  it("カスタム 4 色を復元する", () => {
    const colors = {
      background: "#112233",
      header: "#445566",
      button: "#778899",
      selectedButton: "#AABBCC"
    };
    expect(normalizeThemeSettings({ mode: "dark", colors }).colors).toEqual({
      background: "#112233",
      header: "#445566",
      button: "#778899",
      selectedButton: "#AABBCC"
    });
  });

  it("malformed JSON ではデフォルトに戻る", () => {
    localStorage.setItem(THEME_SETTINGS_STORAGE_KEY, "{not-json");
    expect(loadThemeSettings()).toEqual({ mode: "light", colors: LIGHT_THEME_COLORS });
  });

  it("invalid HEX はデフォルト色に置き換える", () => {
    const result = normalizeThemeSettings({
      mode: "light",
      colors: {
        background: "red",
        header: "#fff",
        button: "#5E7E93",
        selectedButton: 12
      }
    });
    expect(result.colors.background).toBe(LIGHT_THEME_COLORS.background);
    expect(result.colors.header).toBe(LIGHT_THEME_COLORS.header);
    expect(result.colors.button).toBe("#5E7E93");
    expect(result.colors.selectedButton).toBe(LIGHT_THEME_COLORS.selectedButton);
  });

  it("unknown theme mode は light にする", () => {
    expect(normalizeThemeSettings({ mode: "solarized", colors: LIGHT_THEME_COLORS }).mode).toBe("light");
  });

  it("key 不足と古い平坦形式を受理する", () => {
    const nested = normalizeThemeSettings({ mode: "dark" });
    expect(nested.mode).toBe("dark");
    expect(nested.colors.background).toBe(DARK_THEME_COLORS.background);

    const legacy = normalizeThemeSettings({
      mode: "light",
      background: "#123456",
      header: "#234567",
      button: "#345678",
      selectedButton: "#456789"
    });
    expect(legacy.colors).toEqual({
      background: "#123456",
      header: "#234567",
      button: "#345678",
      selectedButton: "#456789"
    });
  });

  it("save / load が round-trip する", () => {
    saveThemeSettings({
      mode: "system",
      colors: {
        background: "#182028",
        header: "#587487",
        button: "#5E7E93",
        selectedButton: "#8CA9BA"
      }
    });
    expect(loadThemeSettings()).toEqual({
      mode: "system",
      colors: {
        background: "#182028",
        header: "#587487",
        button: "#5E7E93",
        selectedButton: "#8CA9BA"
      }
    });
  });
});
